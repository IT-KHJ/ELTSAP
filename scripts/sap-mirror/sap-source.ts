/**
 * SAP SQL Server 읽기 전용 접속 (미러 동기화 전용, 부하 제한).
 * - 연결 1개, 쿼리 순차 실행, 쿼리 사이 간격(QUERY_GAP_MS)
 * - 느린 쿼리 감지 시 간격 자동 증가(SAP 부하가 높을 때 스스로 물러남)
 * - READ UNCOMMITTED: SAP 업무 트랜잭션에 잠금을 걸지 않음
 * - 접속 불가(DBSafer 세션 만료, 네트워크 등)는 SapUnavailableError로 구분 → 다음 실행에서 이어서 처리
 * SAP 원본은 수정하지 않음 (SELECT만).
 */

import sql from "mssql";
import { getSapSqlConfig } from "../../lib/sap-sqlserver";

const QUERY_GAP_MS = 300;
const REQUEST_TIMEOUT_MS = 120000;
/** 드라이버 타임아웃이 동작하지 않고 응답 없이 멈춘 경우(연결이 조용히 끊긴 경우 등)를 잡기 위한 상한 */
const HARD_TIMEOUT_MS = REQUEST_TIMEOUT_MS + 30000;
const SLOW_QUERY_MS = 2000;
/** 쿼리 1개가 이 시간을 넘으면 SAP 부하 상태로 보고 작업 전체를 중단 (평소 최대 약 6초, 2026-10-27 실측) */
const OVERLOAD_QUERY_MS = 30000;
const MAX_BACKOFF_MS = 10000;
const CONNECTION_ERROR_CODES = new Set(["ESOCKET", "ELOGIN", "ECONNCLOSED", "ENOTOPEN", "ECONNRESET", "EINSTLOOKUP"]);

/** SAP 부하 감지로 중단 (SAP 영향 방지 — 재시도하지 않음) */
export class SapOverloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SapOverloadError";
  }
}

export class SapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SapUnavailableError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HardTimeoutError extends Error {}

function withHardTimeout<T>(p: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new HardTimeoutError(`SAP 응답 없음 (${HARD_TIMEOUT_MS / 1000}초 초과)`)), HARD_TIMEOUT_MS);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function isConnectionError(e: unknown): boolean {
  const err = e as { code?: string; name?: string; originalError?: { code?: string } };
  return (
    err?.name === "ConnectionError" ||
    CONNECTION_ERROR_CODES.has(err?.code ?? "") ||
    CONNECTION_ERROR_CODES.has(err?.originalError?.code ?? "")
  );
}

export type SqlInput = [name: string, type: sql.ISqlType | (() => sql.ISqlType), value: unknown];

/** SQL IN 목록 리터럴. 빈 목록이면 어떤 행과도 일치하지 않는 (NULL) */
export function inList(values: (string | number)[]): string {
  if (!values.length) return "(NULL)";
  return `(${values.map((v) => (typeof v === "number" ? String(v) : `N'${v.replace(/'/g, "''")}'`)).join(",")})`;
}

export class SapSource {
  private pool: sql.ConnectionPool | null = null;
  queries = 0;
  queryMs = 0;
  private extraGapMs = 0;

  private async connect(): Promise<sql.ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    const cfg = getSapSqlConfig();
    if (!cfg) throw new Error("SAP SQL Server 연결 정보가 없습니다. (.env.local의 SAP_SQL_*)");
    try {
      this.pool = await new sql.ConnectionPool({
        user: cfg.user,
        password: cfg.password,
        server: cfg.server,
        database: cfg.database,
        ...(cfg.port != null && { port: cfg.port }),
        options: { ...cfg.options, instanceName: cfg.instanceName || undefined, useUTC: true },
        connectionTimeout: 30000,
        requestTimeout: REQUEST_TIMEOUT_MS,
        pool: { max: 1, min: 0 },
      }).connect();
      return this.pool;
    } catch (e) {
      throw new SapUnavailableError(
        `SAP 접속 불가 (DBSafer 세션 만료 또는 네트워크 문제 가능): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  async query<T = Record<string, unknown>>(text: string, inputs: SqlInput[] = []): Promise<T[]> {
    for (let attempt = 1; ; attempt++) {
      const pool = await this.connect();
      const t0 = Date.now();
      try {
        const req = pool.request();
        for (const [name, type, value] of inputs) req.input(name, type, value);
        const r = await withHardTimeout(req.query(`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${text}`));
        const ms = Date.now() - t0;
        this.queries++;
        this.queryMs += ms;
        if (ms > OVERLOAD_QUERY_MS) {
          throw new SapOverloadError(`SAP 쿼리 ${Math.round(ms / 1000)}초 소요 — SAP 부하 상태로 판단해 중단 (기준 ${OVERLOAD_QUERY_MS / 1000}초)`);
        }
        // 느린 쿼리 = SAP 부하가 높다는 신호 → 다음 쿼리까지 더 쉰다
        this.extraGapMs = ms > SLOW_QUERY_MS ? Math.min(MAX_BACKOFF_MS, ms) : Math.floor(this.extraGapMs / 2);
        await sleep(QUERY_GAP_MS + this.extraGapMs);
        return r.recordset as T[];
      } catch (e) {
        if (e instanceof SapOverloadError) throw e;
        // 응답 없음/쿼리 타임아웃은 재시도하면 SAP 부하를 키우므로 즉시 중단
        const code = (e as { code?: string })?.code;
        if (e instanceof HardTimeoutError || code === "ETIMEOUT") {
          await this.close();
          throw new SapOverloadError(`SAP 응답 지연으로 중단: ${e instanceof Error ? e.message : String(e)}`);
        }
        if (isConnectionError(e)) {
          await this.close();
          if (attempt >= 2) {
            throw new SapUnavailableError(
              `SAP 연결 끊김 (DBSafer 세션 만료 또는 네트워크 문제 가능): ${e instanceof Error ? e.message : String(e)}`
            );
          }
          await sleep(5000);
          continue;
        }
        throw e;
      }
    }
  }

  async close(): Promise<void> {
    const p = this.pool;
    this.pool = null;
    if (p) {
      try {
        await p.close();
      } catch {
        // 이미 끊긴 연결
      }
    }
  }
}
