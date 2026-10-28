/**
 * SAP 테이블 컬럼 점검 (새 테이블/새 컬럼 추가 대응용, 읽기 전용·저부하)
 * 실행: npx tsx scripts/sap-mirror/inspect-sap-table.ts <SAP 테이블명> [샘플 건수(기본 300, 최대 1000)]
 * 예:   npx tsx scripts/sap-mirror/inspect-sap-table.ts ODLN
 *
 * - schema.json에 있는 테이블: SAP에는 있지만 명세에 없는 컬럼(신규 후보)과, 명세에는 있지만 SAP에 없는 컬럼을 보여준다.
 * - schema.json에 없는 테이블: 샘플에서 값이 변하는 컬럼을 명세용 JSON 후보로 출력한다.
 * - 개인정보로 제외한 컬럼(excludedColumns)은 후보로 제안하지 않는다.
 *
 * SAP 부하 최소화: 카탈로그(INFORMATION_SCHEMA/CUFD/sys.indexes) 조회 + 기본키 역순 TOP N 샘플 1회,
 * READ UNCOMMITTED(잠금 회피), 연결 1개. 집계는 로컬에서 수행. SAP 원본은 수정하지 않음.
 * (.env.local에 SAP_SQL_* 필요)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import sql from "mssql";
import { getSapSqlConfig } from "../../lib/sap-sqlserver";
import { loadSpec, type ColumnSpec } from "./spec";

interface MetaRow {
  c: string;
  type: string;
  prec: number | null;
  scale: number | null;
  pos: number;
}

function isMidnight(v: unknown): boolean {
  if (!(v instanceof Date)) return true;
  return v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0 && v.getUTCMilliseconds() === 0;
}

function toPgType(m: MetaRow, samples: Record<string, unknown>[]): string {
  switch (m.type) {
    case "int":
      return "integer";
    case "smallint":
    case "tinyint":
      return "smallint";
    case "bigint":
      return "bigint";
    case "numeric":
    case "decimal":
      return `numeric(${m.prec},${m.scale})`;
    case "float":
    case "real":
      return "double precision";
    case "datetime":
    case "smalldatetime":
    case "datetime2":
    case "date":
      return samples.every((r) => isMidnight(r[m.c])) ? "date" : "timestamp";
    case "nvarchar":
    case "varchar":
    case "nchar":
    case "char":
    case "ntext":
    case "text":
      return "text";
    case "varbinary":
    case "binary":
    case "image":
      return "bytea";
    default:
      return `/* 미지원 타입 ${m.type} */ text`;
  }
}

async function main() {
  const table = (process.argv[2] ?? "").trim().toUpperCase();
  const sampleSize = Math.min(1000, Math.max(1, parseInt(process.argv[3] ?? "300", 10) || 300));
  if (!/^[A-Z0-9_@]+$/.test(table)) {
    console.error("사용법: npx tsx scripts/sap-mirror/inspect-sap-table.ts <SAP 테이블명> [샘플 건수]");
    process.exit(1);
  }

  const cfg = getSapSqlConfig();
  if (!cfg) throw new Error("SAP SQL Server 연결 정보가 없습니다. (.env.local의 SAP_SQL_*)");
  const pool = await new sql.ConnectionPool({
    user: cfg.user,
    password: cfg.password,
    server: cfg.server,
    database: cfg.database,
    ...(cfg.port != null && { port: cfg.port }),
    options: { ...cfg.options, instanceName: cfg.instanceName || undefined, useUTC: true },
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: { max: 1 },
  }).connect();

  const query = async <T>(text: string): Promise<T[]> => {
    const r = await pool
      .request()
      .input("t", sql.NVarChar(50), table)
      .query(`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${text}`);
    return r.recordset as T[];
  };

  try {
    const meta = await query<MetaRow>(`
      SELECT COLUMN_NAME AS c, DATA_TYPE AS type, NUMERIC_PRECISION AS prec, NUMERIC_SCALE AS scale, ORDINAL_POSITION AS pos
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION`);
    if (!meta.length) throw new Error(`SAP에 ${table} 테이블이 없습니다.`);
    const udf = await query<{ c: string; descr: string }>(
      `SELECT 'U_' + AliasID AS c, Descr AS descr FROM CUFD WHERE TableID = @t`
    );
    const pkRows = await query<{ c: string; ord: number }>(`
      SELECT c.name AS c, ic.key_ordinal AS ord
      FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE t.name = @t AND i.is_primary_key = 1 ORDER BY ic.key_ordinal`);
    const pk = pkRows.map((r) => r.c);
    const orderBy = pk.length ? pk.map((c) => `[${c}] DESC`).join(", ") : "(SELECT NULL)";
    const samples = await query<Record<string, unknown>>(`SELECT TOP ${sampleSize} * FROM [${table}] ORDER BY ${orderBy}`);

    const descrOf = new Map(udf.map((u) => [u.c, u.descr]));
    const stats = meta.map((m) => {
      const vals = samples.map((r) => r[m.c]);
      const distinct = new Set(vals.map((v) => (v instanceof Date ? v.toISOString() : String(v)))).size;
      const filled = vals.filter((v) => v != null && v !== "" && v !== 0).length;
      return { meta: m, distinct, filled, descr: descrOf.get(m.c) ?? null };
    });

    const spec = loadSpec();
    const existing = spec.tables.find((t) => t.sap === table);
    const toCandidate = (s: (typeof stats)[number]): ColumnSpec => ({
      sap: s.meta.c,
      pg: s.meta.c.toLowerCase(),
      sapType: s.meta.type,
      pgType: toPgType(s.meta, samples),
      descr: s.descr,
      reason: "varying",
    });

    console.log(`== ${table}: SAP 컬럼 ${meta.length}개, 기본키 [${pk.join(", ")}], 샘플 ${samples.length}건`);
    if (existing) {
      const inSpec = new Set(existing.columns.map((c) => c.sap));
      const excluded = new Set(existing.excludedColumns.map((e) => e.sap));
      const sapCols = new Set(meta.map((m) => m.c));
      const missingInSap = existing.columns.filter((c) => !sapCols.has(c.sap)).map((c) => c.sap);
      const newCandidates = stats.filter((s) => !inSpec.has(s.meta.c) && !excluded.has(s.meta.c) && s.distinct > 1);
      const unchanged = stats.filter((s) => !inSpec.has(s.meta.c) && !excluded.has(s.meta.c) && s.distinct <= 1).length;
      console.log(`명세 컬럼 ${existing.columns.length}개 / 개인정보 제외 ${excluded.size}개 / 미포함(샘플상 값 고정) ${unchanged}개`);
      if (missingInSap.length) console.log(`[경고] 명세에는 있으나 SAP에 없는 컬럼: ${missingInSap.join(", ")}`);
      console.log(`신규 후보(명세에 없고 샘플에서 값이 변함) ${newCandidates.length}개:`);
      console.log(JSON.stringify(newCandidates.map(toCandidate), null, 1));
    } else {
      const candidates = stats.filter((s) => s.distinct > 1 || pk.includes(s.meta.c));
      console.log(`schema.json에 없는 테이블입니다. 명세 후보 컬럼 ${candidates.length}개 (기본키 + 샘플에서 값이 변하는 컬럼):`);
      console.log(JSON.stringify({ sap: table, pk, columns: candidates.map(toCandidate) }, null, 1));
      console.log("※ 개인정보 컬럼이 있으면 columns에서 빼고 excludedColumns에 사유와 함께 기록할 것.");
    }
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
