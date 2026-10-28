/**
 * Supabase 쓰기 (미러 동기화 전용, 서비스 키 사용).
 * - 문서 단위 교체는 DB 함수 sap_mirror_replace_docs로 한 트랜잭션 처리
 * - 일시적 네트워크 오류는 재시도
 * - 동기화 상태/실행 이력/초기 적재 진행/거래처 등록부 관리
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/** RPC 1회당 최대 라인 수 (요청 크기 제한 대비). 문서 하나는 쪼개지 않는 것이 원칙 */
const MAX_ROWS_PER_CALL = 500;
const RETRIES = 3;
/** 응답 없이 멈춘 요청을 끊고 재시도하기 위한 RPC 타임아웃 */
const RPC_TIMEOUT_MS = 120000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MirrorWriter {
  private sb: SupabaseClient;
  rowsWritten = 0;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다. (.env.local)");
    this.sb = createClient(url, key, { auth: { persistSession: false } });
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const { data, error } = await this.sb.rpc(fn, args).abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS));
      if (!error) return data as T;
      if (attempt >= RETRIES) throw new Error(`Supabase ${fn} 실패 (${attempt}회 시도): ${error.message}`);
      await sleep(2000 * attempt);
    }
  }

  /** 기본키 기준 upsert (마스터, 입금 등 라인 없는 테이블) */
  async upsert(table: string, rows: Row[]): Promise<void> {
    for (let i = 0; i < rows.length; i += MAX_ROWS_PER_CALL) {
      const chunk = rows.slice(i, i + MAX_ROWS_PER_CALL);
      await this.rpc("sap_mirror_upsert", { p_table: table, p_rows: chunk });
      this.rowsWritten += chunk.length;
    }
  }

  /**
   * 문서 교체: 헤더 upsert + 해당 문서 라인 전체 삭제 후 재삽입.
   * 문서 경계를 지키며 RPC를 나눈다. 라인이 MAX_ROWS_PER_CALL보다 많은 단일 문서는
   * 첫 호출에서 교체 후 나머지 라인을 이어서 upsert한다.
   */
  async replaceDocs(headerTable: string, lineTable: string, key: "docentry" | "transid", headers: Row[], lines: Row[]): Promise<void> {
    const linesByKey = new Map<unknown, Row[]>();
    for (const l of lines) {
      const k = l[key];
      const list = linesByKey.get(k);
      if (list) list.push(l);
      else linesByKey.set(k, [l]);
    }
    let batchHeaders: Row[] = [];
    let batchLines: Row[] = [];
    const flush = async () => {
      if (!batchHeaders.length) return;
      await this.rpc("sap_mirror_replace_docs", {
        p_header_table: headerTable,
        p_line_table: lineTable,
        p_key: key,
        p_headers: batchHeaders,
        p_lines: batchLines,
      });
      this.rowsWritten += batchHeaders.length + batchLines.length;
      batchHeaders = [];
      batchLines = [];
    };
    for (const h of headers) {
      const docLines = linesByKey.get(h[key]) ?? [];
      if (docLines.length > MAX_ROWS_PER_CALL) {
        await flush();
        batchHeaders = [h];
        batchLines = docLines.slice(0, MAX_ROWS_PER_CALL);
        await flush();
        await this.upsert(lineTable, docLines.slice(MAX_ROWS_PER_CALL));
        continue;
      }
      if (batchLines.length + docLines.length > MAX_ROWS_PER_CALL) await flush();
      batchHeaders.push(h);
      batchLines.push(...docLines);
    }
    await flush();
  }

  async monthStats(
    table: string,
    dateCol: string,
    sumCol: string,
    opts: { subCol?: string; from?: string; to?: string; headerTable?: string } = {}
  ): Promise<{ ym: string | null; cnt: number; total: string }[]> {
    return this.rpc("sap_mirror_month_stats", {
      p_table: table,
      p_date_col: dateCol,
      p_sum_col: sumCol,
      p_sub_col: opts.subCol ?? null,
      p_from: opts.from ?? null,
      p_header_table: opts.headerTable ?? null,
      p_to: opts.to ?? null,
    });
  }

  async deleteMissing(table: string, key: string, keys: string[]): Promise<number> {
    return this.rpc("sap_mirror_delete_missing", { p_table: table, p_key: key, p_keys: keys });
  }

  // ---- 동기화 상태 (table_name 키: 'ODLN' = 신규 문서 기준키, 'ODLN@hourly' 등 = 변경 감지 기준일)

  async getState(name: string): Promise<{ last_update_date: string | null; last_doc_entry: number | null } | null> {
    const { data, error } = await this.sb
      .from("sap_mirror_state")
      .select("last_update_date, last_doc_entry")
      .eq("table_name", name)
      .maybeSingle();
    if (error) throw new Error(`sap_mirror_state 조회 실패: ${error.message}`);
    return data;
  }

  async setState(name: string, values: { last_update_date?: string; last_doc_entry?: number; initial_loaded_at?: string }): Promise<void> {
    const { error } = await this.sb
      .from("sap_mirror_state")
      .upsert({ table_name: name, ...values, last_synced_at: new Date().toISOString() }, { onConflict: "table_name" });
    if (error) throw new Error(`sap_mirror_state 저장 실패: ${error.message}`);
  }

  // ---- SAP 부하 감지 시 전체 정지 플래그 (sap_mirror_state의 'HALT' 행, 수동 해제 전까지 모든 실행 거부)

  async isHalted(): Promise<boolean> {
    return (await this.getState("HALT")) != null;
  }

  async setHalt(): Promise<void> {
    await this.setState("HALT", {});
  }

  async clearHalt(): Promise<void> {
    const { error } = await this.sb.from("sap_mirror_state").delete().eq("table_name", "HALT");
    if (error) throw new Error(`HALT 해제 실패: ${error.message}`);
  }

  // ---- 실행 이력 / 중복 실행 방지

  /**
   * 실행 중(running)인 다른 실행이 있으면 true. 비정상 종료로 남은 오래된 기록은 무시:
   * 일반 실행은 6시간, 초기 적재(init/reload)는 장시간 작업이므로 24시간까지 유효로 본다.
   */
  async isLocked(): Promise<boolean> {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const { data, error } = await this.sb
      .from("sap_mirror_runs")
      .select("id, mode, started_at")
      .eq("status", "running")
      .gte("started_at", hoursAgo(24));
    if (error) throw new Error(`sap_mirror_runs 조회 실패: ${error.message}`);
    const shortCutoff = Date.now() - 6 * 3600 * 1000;
    return (data ?? []).some(
      (r: { mode: string; started_at: string }) =>
        r.mode === "init" || r.mode === "reload" || Date.parse(r.started_at) >= shortCutoff
    );
  }

  async startRun(mode: string, tableName: string | null): Promise<number> {
    const { data, error } = await this.sb
      .from("sap_mirror_runs")
      .insert({ mode, table_name: tableName })
      .select("id")
      .single();
    if (error) throw new Error(`sap_mirror_runs 기록 실패: ${error.message}`);
    return data.id as number;
  }

  async finishRun(id: number, status: "success" | "failed" | "sap_unavailable" | "sap_overload", rows: number, message: string): Promise<void> {
    const { error } = await this.sb
      .from("sap_mirror_runs")
      .update({ status, rows, message: message.slice(0, 4000), finished_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error(`sap_mirror_runs 종료 기록 실패: ${error.message}`);
  }

  // ---- 초기 적재 진행

  async getProgress(): Promise<Set<string>> {
    const done = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb
        .from("sap_mirror_init_progress")
        .select("table_name, cardcode")
        .range(from, from + 999);
      if (error) throw new Error(`sap_mirror_init_progress 조회 실패: ${error.message}`);
      for (const r of data ?? []) done.add(`${r.table_name}|${r.cardcode}`);
      if (!data || data.length < 1000) return done;
    }
  }

  async markProgress(tableName: string, cardcode: string, rows: number): Promise<void> {
    const { error } = await this.sb
      .from("sap_mirror_init_progress")
      .upsert({ table_name: tableName, cardcode, rows, done_at: new Date().toISOString() }, { onConflict: "table_name,cardcode" });
    if (error) throw new Error(`sap_mirror_init_progress 저장 실패: ${error.message}`);
  }

  async clearProgress(tableName: string, cardcode?: string): Promise<void> {
    let q = this.sb.from("sap_mirror_init_progress").delete().eq("table_name", tableName);
    if (cardcode) q = q.eq("cardcode", cardcode);
    const { error } = await q;
    if (error) throw new Error(`sap_mirror_init_progress 삭제 실패: ${error.message}`);
  }

  // ---- 거래처 등록부

  async getCustomers(): Promise<{ cardcode: string; elt: boolean; loaded_at: string | null }[]> {
    const { data, error } = await this.sb.from("sap_mirror_customers").select("cardcode, elt, loaded_at");
    if (error) throw new Error(`sap_mirror_customers 조회 실패: ${error.message}`);
    return data ?? [];
  }

  /** SAP 현재 ELT 거래처 목록을 등록부에 반영 (새 거래처 추가, 빠진 거래처는 elt=false로 표시, 데이터는 보관) */
  async syncCustomerRegistry(eltCodes: string[]): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.getCustomers();
    const elt = new Set(eltCodes);
    const rows = [
      ...eltCodes.map((c) => ({ cardcode: c, elt: true, last_seen_at: now })),
      ...existing.filter((c) => !elt.has(c.cardcode) && c.elt).map((c) => ({ cardcode: c.cardcode, elt: false })),
    ];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb.from("sap_mirror_customers").upsert(rows.slice(i, i + 500), { onConflict: "cardcode" });
      if (error) throw new Error(`sap_mirror_customers 저장 실패: ${error.message}`);
    }
  }

  async markCustomerLoaded(cardcode: string): Promise<void> {
    const { error } = await this.sb
      .from("sap_mirror_customers")
      .upsert({ cardcode, loaded_at: new Date().toISOString() }, { onConflict: "cardcode" });
    if (error) throw new Error(`sap_mirror_customers 저장 실패: ${error.message}`);
  }

  async saveRecon(rows: { table_name: string; ym: string; sap_rows: number; mirror_rows: number; sap_sum: string; mirror_sum: string }[]): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb
        .from("sap_mirror_recon")
        .upsert(rows.slice(i, i + 500).map((r) => ({ ...r, checked_at: now })), { onConflict: "table_name,ym" });
      if (error) throw new Error(`sap_mirror_recon 저장 실패: ${error.message}`);
    }
  }
}
