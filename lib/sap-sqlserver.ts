/**
 * SAP SQL Server 직접 접속 (읽기 전용).
 * neelt 백엔드(pyodbc) 연동 방식에 맞춤: 서버\인스턴스 형식, TrustServerCertificate 기본 true.
 * 동기화 시 SELECT만 수행하며 SAP 원본은 수정하지 않음.
 * 증분 동기화: SAP CreateDate/UpdateDate와 last_synced_at을 날짜(YYYY-MM-DD) 단위로만 비교. 타임존 무관.
 */

import sql from "mssql";
import { DATE_MIN_SYNC } from "./constants";

/** 증분 조건: SAP CreateDate/UpdateDate의 날짜 부분만 비교. since는 YYYY-MM-DD */
function incrementalClause(columnPrefix: string): string {
  const createCol = columnPrefix ? `${columnPrefix}.CreateDate` : "CreateDate";
  const updateCol = columnPrefix ? `${columnPrefix}.UpdateDate` : "UpdateDate";
  return `AND (
    CAST(${createCol} AS DATE) >= CAST(@since AS DATE)
    OR CAST(${updateCol} AS DATE) >= CAST(@since AS DATE)
  )`;
}

export interface SapSqlConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  instanceName?: string;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    enableArithAbort?: boolean;
  };
}

const DEFAULT_PORT = 1433;

/** SAP_SQL_SERVER에 "호스트\인스턴스" 형식이면 분리. neelt와 동일하게 인스턴스 사용 시 port 미사용 */
function parseServer(serverRaw: string): { server: string; instanceName?: string; usePort: boolean } {
  const s = serverRaw.trim();
  if (s.includes("\\")) {
    const [server, instanceName] = s.split("\\").map((x) => x.trim()).filter(Boolean);
    return { server: server ?? s, instanceName: instanceName || undefined, usePort: false };
  }
  return { server: s, usePort: true };
}

export function getSapSqlConfig(): SapSqlConfig | null {
  const serverRaw = process.env.SAP_SQL_SERVER;
  const database = process.env.SAP_SQL_DATABASE;
  const user = process.env.SAP_SQL_USER;
  const password = process.env.SAP_SQL_PASSWORD;
  if (!serverRaw || !database || !user || !password) return null;
  const { server, instanceName, usePort } = parseServer(serverRaw);
  const portEnv = process.env.SAP_SQL_PORT;
  const port = portEnv ? parseInt(portEnv, 10) : DEFAULT_PORT;
  const explicitInstance = process.env.SAP_SQL_INSTANCE?.trim();
  const trustCert = process.env.SAP_SQL_TRUST_CERT !== "false";
  // 원격 IP 접속 시 Encrypt=true면 TLS 단계에서 socket hang up 발생 가능 → 기본 비암호화
  const encrypt = process.env.SAP_SQL_ENCRYPT === "true";
  return {
    server,
    database,
    user,
    password,
    port: usePort && !Number.isNaN(port) ? port : undefined,
    instanceName: explicitInstance || instanceName,
    options: {
      encrypt,
      trustServerCertificate: trustCert,
      enableArithAbort: true,
    },
  };
}

export function isSapSqlServerConfigured(): boolean {
  return getSapSqlConfig() !== null;
}

async function getPool(): Promise<sql.ConnectionPool> {
  const config = getSapSqlConfig();
  if (!config) throw new Error("SAP SQL Server 연결 정보가 설정되지 않았습니다. (SAP_SQL_SERVER, SAP_SQL_DATABASE, SAP_SQL_USER, SAP_SQL_PASSWORD)");
  const poolConfig = {
    user: config.user,
    password: config.password,
    server: config.server,
    database: config.database,
    ...(config.port != null && { port: config.port }),
    options: {
      encrypt: config.options?.encrypt ?? false,
      trustServerCertificate: config.options?.trustServerCertificate ?? true,
      enableArithAbort: config.options?.enableArithAbort ?? true,
      instanceName: config.instanceName || undefined,
      useUTC: true, // last_synced_at(UTC)와 SAP 로컬 시간 비교 시 일관성
    },
    connectionTimeout: 60000,
    requestTimeout: 120000,
  };
  const pool = await sql.connect(poolConfig);
  return pool;
}

/** OCRD CreateDate/UpdateDate 범위 조회 (디버깅용) */
export async function querySapCustomerDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request();
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(UpdateDate), 121) as maxUpdateDate
      FROM OCRD
      WHERE groupcode IN ('100','104') AND u_costcd = '24021'
      ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** OCRD → 거래처 (groupcode IN ('100','104'), u_costcd='24021'). since 있으면 증분( CreateDate/UpdateDate >= since ) */
export async function querySapCustomer(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request();
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const sqlQuery = since
      ? `
      SELECT
        cardcode, cardname, groupcode, address, zipcode,
        phone1, phone2, fax, cntctprsn, notes, e_mail,
        shiptodef, vatregnum, repname, aliasname, billtodef, u_delyn
      FROM OCRD
      WHERE groupcode IN ('100','104')
        AND u_costcd = '24021'
        ${incrementalClause("")}
    `
      : `
      SELECT
        cardcode, cardname, groupcode, address, zipcode,
        phone1, phone2, fax, cntctprsn, notes, e_mail,
        shiptodef, vatregnum, repname, aliasname, billtodef, u_delyn
      FROM OCRD
      WHERE groupcode IN ('100','104')
        AND u_costcd = '24021'
    `;
    const result = await req.query(sqlQuery);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** OITM CreateDate/UpdateDate 범위 조회 (디버깅용) */
export async function querySapItemlistDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request();
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(UpdateDate), 121) as maxUpdateDate
      FROM OITM
      WHERE 1=1 ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** OITM → 품목 (U_LEVEL3NM → brand, U_LEVEL2 → itemgb). since 있으면 증분, 타임존 정렬 */
export async function querySapItemlist(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request();
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const sqlQuery = since
      ? `
      SELECT itemcode, itemname, itmsgrpcod, codebars, U_LEVEL3NM AS brand, U_LEVEL2 AS itemgb
      FROM OITM
      WHERE 1=1 ${incrementalClause("")}
    `
      : `
      SELECT itemcode, itemname, itmsgrpcod, codebars, U_LEVEL3NM AS brand, U_LEVEL2 AS itemgb
      FROM OITM
    `;
    const result = await req.query(sqlQuery);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** INV1+OINV CreateDate/UpdateDate 범위 조회 (디버깅용) */
export async function querySapSalesDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(o.CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(o.CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(o.UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(o.UpdateDate), 121) as maxUpdateDate
      FROM INV1 i
      INNER JOIN OINV o ON o.docentry = i.docentry
      WHERE o.cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
      AND o.docdate >= @minDate AND o.canceled = 'N' AND ISNULL(i.ocrcode2, '') = '2101'
      ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** INV1 + OINV → 매출 (2024-01-01 이후, canceled='N', ocrcode2='2101'), LineNum 포함. since 있으면 OINV 기준 증분 */
export async function querySapSales(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        i.docentry,
        ISNULL(i.LineNum, 0) AS linenum,
        i.itemcode, i.quantity, i.price, i.discprcnt, i.pricebefdi,
        i.docdate, i.basecard, i.totalsumsy, i.vatsumsy,
        ISNULL(i.LineStatus, 'O') AS linestatus
      FROM INV1 i
      INNER JOIN OINV o ON o.docentry = i.docentry
      WHERE o.cardcode IN (
        SELECT cardcode FROM OCRD
        WHERE groupcode IN ('100','104') AND u_costcd = '24021'
      )
      AND o.docdate >= @minDate
      AND o.canceled = 'N'
      AND ISNULL(i.ocrcode2, '') = '2101'
      ${incClause}
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** ORCT CreateDate/UpdateDate 범위 조회 (디버깅용) */
export async function querySapInamtDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(UpdateDate), 121) as maxUpdateDate
      FROM ORCT
      WHERE cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
      AND docdate >= @minDate AND canceled = 'N'
      ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** ORCT → 입금 (2024-01-01 이후, canceled='N'). since 있으면 증분 */
export async function querySapInamt(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const incClause = since ? incrementalClause("") : "";
    const result = await req.query(`
      SELECT docentry, docdate, cardcode, doctotal
      FROM ORCT
      WHERE cardcode IN (
        SELECT cardcode FROM OCRD
        WHERE groupcode IN ('100','104') AND u_costcd = '24021'
      )
      AND docdate >= @minDate
      AND canceled = 'N'
      ${incClause}
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** IGE1+OIGE CreateDate/UpdateDate 범위 조회 (디버깅용) */
export async function querySapSaleetcDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(o.CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(o.CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(o.UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(o.UpdateDate), 121) as maxUpdateDate
      FROM IGE1 i
      INNER JOIN OIGE o ON o.docentry = i.docentry
      WHERE o.cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
      AND o.docdate >= @minDate AND o.canceled = 'N'
      ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** ODLN CreateDate/UpdateDate 범위 조회 (orders 증분 동기화용) */
export async function querySapOrdersDateRange(
  since?: string | null
): Promise<{ minCreateDate: string | null; maxCreateDate: string | null; minUpdateDate: string | null; maxUpdateDate: string | null }> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) req.input("since", sql.VarChar(10), since);
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        CONVERT(VARCHAR(23), MIN(o.CreateDate), 121) as minCreateDate,
        CONVERT(VARCHAR(23), MAX(o.CreateDate), 121) as maxCreateDate,
        CONVERT(VARCHAR(23), MIN(o.UpdateDate), 121) as minUpdateDate,
        CONVERT(VARCHAR(23), MAX(o.UpdateDate), 121) as maxUpdateDate
      FROM DLN1 i
      INNER JOIN ODLN o ON o.docentry = i.docentry
      WHERE o.cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
      AND o.docdate >= @minDate AND o.canceled = 'N'
      AND i.ocrcode = '24021'
      ${incClause}
    `);
    const row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined;
    const fmt = (v: unknown) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
    return {
      minCreateDate: fmt(row?.minCreateDate),
      maxCreateDate: fmt(row?.maxCreateDate),
      minUpdateDate: fmt(row?.minUpdateDate),
      maxUpdateDate: fmt(row?.maxUpdateDate),
    };
  } finally {
    await pool.close();
  }
}

/** ODLN docentry 조회 (증분 동기화 삭제용). since 이후 CreateDate/UpdateDate 변경된 문서 - canceled 포함 */
export async function querySapOrdersTouchedDocentries(since: string): Promise<number[]> {
  const pool = await getPool();
  try {
    const req = pool
      .request()
      .input("minDate", sql.VarChar(10), DATE_MIN_SYNC)
      .input("since", sql.VarChar(10), since);
    const result = await req.query(`
      SELECT DISTINCT o.docentry
      FROM ODLN o
      WHERE o.cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
        AND o.docdate >= @minDate
        AND (CAST(o.CreateDate AS DATE) >= CAST(@since AS DATE) OR CAST(o.UpdateDate AS DATE) >= CAST(@since AS DATE))
    `);
    const rows = (result.recordset ?? []) as Array<{ docentry: number }>;
    return rows.map((r) => Number(r.docentry) || 0).filter((id) => id > 0);
  } finally {
    await pool.close();
  }
}

/** DLN1 + ODLN → orders 동기화. since 있으면 증분(ODLN CreateDate/UpdateDate), 없으면 전체(docdate >= 2024-01-01) */
export async function querySapOrders(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        i.docentry,
        ISNULL(i.LineNum, 0) AS linenum,
        o.docdate AS docdate,
        i.basecard AS basecard,
        b.cardname AS cardname,
        b.aliasname AS aliasname,
        i.itemcode AS itemcode,
        (SELECT itemname FROM OITM WHERE itemcode = i.itemcode) AS itemname,
        i.pricebefdi AS price,
        ROUND(100 - ISNULL(i.discprcnt, 0), 0) AS supply_rate,
        ROUND(ISNULL(i.discprcnt, 0), 0) AS discount_rate,
        i.quantity,
        i.totalsumsy,
        i.vatsumsy AS vatamt,
        CASE WHEN i.totalsumsy < 0 THEN i.totalsumsy ELSE 0 END AS returnamt
      FROM DLN1 i
      INNER JOIN ODLN o ON o.docentry = i.docentry
      INNER JOIN OCRD b ON i.basecard = b.cardcode
      WHERE o.cardcode IN (SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021')
      AND o.docdate >= @minDate
      AND o.canceled = 'N'
      AND ISNULL(i.ocrcode, '') = '24021'
      AND ISNULL(i.LineStatus, 'O') = 'O'
      ${incClause}
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** DLN1 + ODLN → 거래처 현황(판매기준) 실시간 조회. docdate 범위, cardcode 필터, ocrcode='24021' */
export async function querySapDln1SalesStatus(
  startDate: string,
  endDate: string,
  cardcode?: string | null
): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const startYmd = startDate.replace(/-/g, "");
    const endYmd = endDate.replace(/-/g, "");
    const req = pool
      .request()
      .input("startDate", sql.VarChar(8), startYmd)
      .input("endDate", sql.VarChar(8), endYmd);
    const cardFilter =
      cardcode && cardcode.trim() ? `AND o.cardcode = @cardcode` : "AND o.cardcode LIKE '%'";
    if (cardcode && cardcode.trim()) {
      req.input("cardcode", sql.VarChar(50), cardcode.trim());
    }
    const result = await req.query(`
      SELECT
        a.docdate AS docdate,
        a.basecard AS basecard,
        a.cardname AS cardname,
        a.aliasname AS aliasname,
        a.itemcode AS itemcode,
        a.itemname AS itemname,
        a.price AS price,
        ROUND(a.demrate, 0) AS supply_rate,
        ROUND(a.disrate, 0) AS discount_rate,
        a.quantity AS quantity,
        a.totalsumsy AS totalsumsy,
        a.vatamt AS vatamt,
        a.returnamt AS returnamt
      FROM (
        SELECT
          a.docdate,
          a.basecard,
          b.cardname,
          b.aliasname,
          a.itemcode,
          (SELECT itemname FROM OITM WHERE itemcode = a.itemcode) AS itemname,
          a.pricebefdi AS price,
          100 - a.discprcnt AS demrate,
          a.discprcnt AS disrate,
          a.price AS disprice,
          a.quantity,
          a.totalsumsy,
          a.vatsumsy AS vatamt,
          CASE WHEN a.totalsumsy < 0 THEN a.totalsumsy ELSE 0 END AS returnamt
        FROM DLN1 a
        INNER JOIN OCRD b ON a.basecard = b.cardcode
        WHERE a.docentry IN (
          SELECT docentry FROM ODLN o
          WHERE o.docdate >= @startDate AND o.docdate <= @endDate
          AND o.canceled = 'N'
          ${cardFilter}
        )
        AND a.ocrcode = '24021'
        AND a.linestatus = 'O'
      ) a
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** DLN1 + ODLN → 거래처 현황(판매기준) B안 그룹화 조회. docdate 범위, ocrcode='24021' */
export async function querySapDln1SalesStatusGrouped(
  startDate: string,
  endDate: string,
  salesType: "all" | "sales" | "return"
): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const startYmd = startDate.replace(/-/g, "");
    const endYmd = endDate.replace(/-/g, "");
    const salesFilter =
      salesType === "sales"
        ? "AND a.totalsumsy > 0"
        : salesType === "return"
          ? "AND a.totalsumsy < 0"
          : "";
    const result = await pool
      .request()
      .input("startDate", sql.VarChar(8), startYmd)
      .input("endDate", sql.VarChar(8), endYmd)
      .query(`
        SELECT
          a.basecard AS basecard,
          a.cardname AS cardname,
          SUM(a.quantity) AS quantity,
          SUM(a.totalsumsy) AS sales_amount,
          SUM(a.vatamt) AS vat_amount,
          SUM(a.totalamt) AS total_amount,
          ABS(SUM(a.returnamt)) AS return_amount
        FROM (
          SELECT
            a.basecard,
            (SELECT cardname FROM OCRD WHERE cardcode = a.basecard) AS cardname,
            a.quantity,
            a.totalsumsy,
            a.vatsumsy AS vatamt,
            a.totalsumsy + a.vatsumsy AS totalamt,
            CASE WHEN a.totalsumsy < 0 THEN a.totalsumsy ELSE 0 END AS returnamt
          FROM DLN1 a
          WHERE a.docentry IN (
            SELECT docentry FROM ODLN o
            WHERE o.docdate >= @startDate AND o.docdate <= @endDate
            AND o.canceled = 'N'
          )
          AND a.ocrcode = '24021'
          AND a.linestatus = 'O'
          ${salesFilter}
        ) a
        GROUP BY a.basecard, a.cardname
      `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** IGE1 + OIGE → 기타출고 (2024-01-01 이후, canceled='N'). 동일 거래처 조건 적용. since 있으면 OIGE 기준 증분 */
export async function querySapSaleetc(since?: string | null): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const req = pool.request().input("minDate", sql.VarChar(10), DATE_MIN_SYNC);
    if (since) {
      req.input("since", sql.VarChar(10), since);
    }
    const incClause = since ? incrementalClause("o") : "";
    const result = await req.query(`
      SELECT
        i.docentry,
        ISNULL(i.LineNum, 0) AS linenum,
        i.itemcode, i.quantity, i.docdate, i.basecard
      FROM IGE1 i
      INNER JOIN OIGE o ON o.docentry = i.docentry
      WHERE o.cardcode IN (
        SELECT cardcode FROM OCRD
        WHERE groupcode IN ('100','104') AND u_costcd = '24021'
      )
      AND o.docdate >= @minDate
      AND o.canceled = 'N'
      ${incClause}
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}
