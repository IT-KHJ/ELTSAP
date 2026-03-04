/**
 * SAP SQL Server 직접 접속 (읽기 전용).
 * neelt 백엔드(pyodbc) 연동 방식에 맞춤: 서버\인스턴스 형식, TrustServerCertificate 기본 true.
 * 동기화 시 SELECT만 수행하며 SAP 원본은 수정하지 않음.
 */

import sql from "mssql";
import { DATE_MIN_SYNC } from "./constants";

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
    },
    connectionTimeout: 60000,
    requestTimeout: 120000,
  };
  const pool = await sql.connect(poolConfig);
  return pool;
}

/** OCRD → 거래처 (groupcode='100', u_costcd='24021') */
export async function querySapCustomer(): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const result = await pool.request().query(`
      SELECT
        cardcode, cardname, groupcode, address, zipcode,
        phone1, phone2, fax, cntctprsn, notes, e_mail,
        shiptodef, vatregnum, repname, aliasname, billtodef, u_delyn
      FROM OCRD
      WHERE groupcode = '100'
        AND u_costcd = '24021'
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** OITM → 품목 (U_LEVEL3NM → brand, U_LEVEL2 → itemgb) */
export async function querySapItemlist(): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const result = await pool.request().query(`
      SELECT itemcode, itemname, itmsgrpcod, codebars, U_LEVEL3NM AS brand, U_LEVEL2 AS itemgb
      FROM OITM
    `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** INV1 + OINV → 매출 (2024-01-01 이후, canceled='N', ocrcode2='2101'), LineNum 포함 */
export async function querySapSales(): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const result = await pool.request()
      .input("minDate", sql.VarChar(10), DATE_MIN_SYNC)
      .query(`
        SELECT
          i.docentry,
          ISNULL(i.LineNum, 0) AS linenum,
          i.itemcode, i.quantity, i.price, i.discprcnt, i.pricebefdi,
          i.docdate, i.basecard, i.totalsumsy
        FROM INV1 i
        INNER JOIN OINV o ON o.docentry = i.docentry
        WHERE o.cardcode IN (
          SELECT cardcode FROM OCRD
          WHERE groupcode = '100' AND u_costcd = '24021'
        )
        AND o.docdate >= @minDate
        AND o.canceled = 'N'
        AND ISNULL(i.ocrcode2, '') = '2101'
      `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** ORCT → 입금 (2024-01-01 이후, canceled='N') */
export async function querySapInamt(): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const result = await pool.request()
      .input("minDate", sql.VarChar(10), DATE_MIN_SYNC)
      .query(`
        SELECT docentry, docdate, cardcode, doctotal
        FROM ORCT
        WHERE cardcode IN (
          SELECT cardcode FROM OCRD
          WHERE groupcode = '100' AND u_costcd = '24021'
        )
        AND docdate >= @minDate
        AND canceled = 'N'
      `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}

/** IGE1 + OIGE → 기타출고 (2024-01-01 이후, canceled='N'). 동일 거래처 조건 적용 */
export async function querySapSaleetc(): Promise<Record<string, unknown>[]> {
  const pool = await getPool();
  try {
    const result = await pool.request()
      .input("minDate", sql.VarChar(10), DATE_MIN_SYNC)
      .query(`
        SELECT
          i.docentry,
          ISNULL(i.LineNum, 0) AS linenum,
          i.itemcode, i.quantity, i.docdate, i.basecard
        FROM IGE1 i
        INNER JOIN OIGE o ON o.docentry = i.docentry
        WHERE o.cardcode IN (
          SELECT cardcode FROM OCRD
          WHERE groupcode = '100' AND u_costcd = '24021'
        )
        AND o.docdate >= @minDate
        AND o.canceled = 'N'
      `);
    return (result.recordset ?? []) as Record<string, unknown>[];
  } finally {
    await pool.close();
  }
}
