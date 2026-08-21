/**
 * SAP 과거 데이터 백필 / 전체 재동기화 스크립트
 * 실행: npx tsx scripts/backfill-history.ts <entity> [시작일] [종료일] [청크일수]
 *   entity: customer | itemlist | sales | inamt | saleetc | orders
 *   customer/itemlist: 시작일/종료일 무시, 날짜 조건 없이 전체 조회 후 upsert (SAP 현재 시점 스냅샷)
 *   sales/inamt/saleetc/orders: getDateMinSync 하한 우회, 지정 기간 직접 조회 후 Supabase upsert
 *     시작일: 기본 2024-01-01 (YYYY-MM-DD)
 *     종료일: 기본 오늘 (YYYY-MM-DD)
 *     청크일수: 생략 시 달력 월(1일~다음달 1일) 단위로 순회(기본, 권장).
 *               값을 주면 그 일수 단위 고정 청크로 동작(SAP 쿼리 타임아웃 시 더 작게, 예: 7)
 * 예: npx tsx scripts/backfill-history.ts sales 2024-01-01 2026-08-20
 *     npx tsx scripts/backfill-history.ts customer
 *
 * SAP는 SELECT만 수행하며 원본을 수정하지 않음. Supabase에는 기존 lib/sync-ops.ts의 upsert 함수만 사용.
 * (.env.local에 SAP_SQL_*, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import sql from "mssql";
import { getSapSqlConfig } from "../lib/sap-sqlserver";
import {
  mapSapRowToCustomer,
  mapSapRowToItemlist,
  mapSapRowToSales,
  mapSapRowToInamt,
  mapSapRowToSaleetc,
  mapSapRowToOrders,
} from "../lib/sap-mappers";
import {
  upsertCustomerBatch,
  upsertItemlistBatch,
  upsertSalesBatch,
  upsertInamtBatch,
  upsertSaleetcBatch,
  upsertOrdersBatch,
} from "../lib/sync-ops";
import type { SyncResult } from "../types/sync";

type Entity = "customer" | "itemlist" | "sales" | "inamt" | "saleetc" | "orders";
const ENTITIES: Entity[] = ["customer", "itemlist", "sales", "inamt", "saleetc", "orders"];
/** 날짜 하한이 없는 엔티티(SAP 현재 시점 전체를 한 번에 조회) */
const FULL_ONLY_ENTITIES: Entity[] = ["customer", "itemlist"];

/** 날짜 하한 없이 전체 조회(customer/itemlist). 기존 lib/sap-sqlserver.ts의 querySapCustomer/querySapItemlist(since=null)와 동일 조건 */
const FULL_QUERIES: Record<"customer" | "itemlist", string> = {
  customer: `
    SELECT
      cardcode, cardname, groupcode, address, zipcode,
      phone1, phone2, fax, cntctprsn, notes, e_mail,
      shiptodef, vatregnum, repname, aliasname, billtodef, u_delyn
    FROM OCRD
    WHERE groupcode IN ('100','104') AND u_costcd = '24021'
  `,
  itemlist: `
    SELECT itemcode, itemname, itmsgrpcod, codebars, U_LEVEL3NM AS brand, U_LEVEL2 AS itemgb
    FROM OITM
  `,
};

/** 기존 lib/sap-sqlserver.ts의 querySap{Sales,Inamt,Saleetc,Orders}와 동일 조건, @minDate 하한/증분절만 제거하고 명시적 기간(@startDate~@endDate)으로 대체 */
const QUERIES: Record<"sales" | "inamt" | "saleetc" | "orders", string> = {
  sales: `
    SELECT
      i.docentry,
      ISNULL(i.LineNum, 0) AS linenum,
      i.itemcode, i.quantity, i.price, i.discprcnt, i.pricebefdi,
      i.docdate, i.basecard, i.totalsumsy, i.vatsumsy,
      ISNULL(i.LineStatus, 'O') AS linestatus
    FROM INV1 i
    INNER JOIN OINV o ON o.docentry = i.docentry
    WHERE o.cardcode IN (
      SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021'
    )
    AND o.docdate >= @startDate AND o.docdate < @endDate
    AND o.canceled = 'N'
    AND ISNULL(i.ocrcode2, '') = '2101'
  `,
  inamt: `
    SELECT docentry, docdate, cardcode, doctotal
    FROM ORCT
    WHERE cardcode IN (
      SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021'
    )
    AND docdate >= @startDate AND docdate < @endDate
    AND canceled = 'N'
  `,
  saleetc: `
    SELECT
      i.docentry,
      ISNULL(i.LineNum, 0) AS linenum,
      i.itemcode, i.quantity, i.docdate, i.basecard
    FROM IGE1 i
    INNER JOIN OIGE o ON o.docentry = i.docentry
    WHERE o.cardcode IN (
      SELECT cardcode FROM OCRD WHERE groupcode IN ('100','104') AND u_costcd = '24021'
    )
    AND o.docdate >= @startDate AND o.docdate < @endDate
    AND o.canceled = 'N'
  `,
  orders: `
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
    AND o.docdate >= @startDate AND o.docdate < @endDate
    AND o.canceled = 'N'
    AND ISNULL(i.ocrcode, '') = '24021'
    AND ISNULL(i.LineStatus, 'O') = 'O'
  `,
};

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ymd(YYYY-MM-DD)에 달력 월을 더함. 기본 흐름(day=1로 시작)에서는 항상 매월 1일을 반환 */
function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

async function queryFullEntity(
  pool: sql.ConnectionPool,
  entity: "customer" | "itemlist"
): Promise<Record<string, unknown>[]> {
  const result = await pool.request().query(FULL_QUERIES[entity]);
  return (result.recordset ?? []) as Record<string, unknown>[];
}

async function queryRangeEntity(
  pool: sql.ConnectionPool,
  entity: "sales" | "inamt" | "saleetc" | "orders",
  startDate: string,
  endDate: string
): Promise<Record<string, unknown>[]> {
  const req = pool
    .request()
    .input("startDate", sql.VarChar(10), startDate)
    .input("endDate", sql.VarChar(10), endDate);
  const result = await req.query(QUERIES[entity]);
  return (result.recordset ?? []) as Record<string, unknown>[];
}

async function upsertForEntity(entity: Entity, rows: Record<string, unknown>[]): Promise<SyncResult> {
  switch (entity) {
    case "customer":
      return upsertCustomerBatch(rows.map((r) => mapSapRowToCustomer(r)));
    case "itemlist":
      return upsertItemlistBatch(rows.map((r) => mapSapRowToItemlist(r)));
    case "sales":
      return upsertSalesBatch(rows.map((r, i) => mapSapRowToSales(r, i)));
    case "inamt":
      return upsertInamtBatch(rows.map((r) => mapSapRowToInamt(r)));
    case "saleetc":
      return upsertSaleetcBatch(rows.map((r, i) => mapSapRowToSaleetc(r, i)));
    case "orders":
      return upsertOrdersBatch(rows.map((r, i) => mapSapRowToOrders(r, i)));
  }
}

async function main() {
  const [, , entityArg, startArg, endArg, chunkArg] = process.argv;
  if (!entityArg || !ENTITIES.includes(entityArg as Entity)) {
    console.error(`사용법: npx tsx scripts/backfill-history.ts <${ENTITIES.join("|")}> [시작일 YYYY-MM-DD] [종료일 YYYY-MM-DD] [청크일수]`);
    process.exit(1);
  }
  const entity = entityArg as Entity;

  const sapConfig = getSapSqlConfig();
  if (!sapConfig) {
    console.error("SAP_SQL_SERVER/DATABASE/USER/PASSWORD가 .env.local에 설정되어 있지 않습니다.");
    process.exit(1);
  }

  const pool = await sql.connect({
    user: sapConfig.user,
    password: sapConfig.password,
    server: sapConfig.server,
    database: sapConfig.database,
    ...(sapConfig.port != null && { port: sapConfig.port }),
    options: {
      encrypt: sapConfig.options?.encrypt ?? false,
      trustServerCertificate: sapConfig.options?.trustServerCertificate ?? true,
      enableArithAbort: sapConfig.options?.enableArithAbort ?? true,
      instanceName: sapConfig.instanceName || undefined,
      useUTC: true,
    },
    connectionTimeout: 60000,
    requestTimeout: 120000,
  });

  try {
    if (FULL_ONLY_ENTITIES.includes(entity)) {
      console.log(`[${entity}] 전체 조회 시작 (날짜 조건 없음, SAP 현재 시점 기준)`);
      const rows = await queryFullEntity(pool, entity as "customer" | "itemlist");
      if (rows.length === 0) {
        console.log(`[${entity}] 0건 조회됨`);
        return;
      }
      const result = await upsertForEntity(entity, rows);
      if (!result.success) {
        console.error(`[${entity}] 실패: ${result.error}`);
        process.exit(1);
      }
      console.log(`[${entity}] 완료. ${rows.length}건 조회, ${result.inserted + result.updated}건 반영`);
      return;
    }

    const dateEntity = entity as "sales" | "inamt" | "saleetc" | "orders";
    const start = startArg ?? "2024-01-01";
    const end = endArg ?? new Date().toISOString().slice(0, 10);
    const chunkDays = chunkArg ? parseInt(chunkArg, 10) : null;

    console.log(
      `[${dateEntity}] 백필 시작: ${start} ~ ${end} (${chunkDays ? `${chunkDays}일 고정 청크` : "달력 월 단위"})`
    );
    let cursor = start;
    let totalRows = 0;
    let totalUpserted = 0;

    while (cursor < end) {
      const nextCursor = chunkDays ? addDays(cursor, chunkDays) : addMonths(cursor, 1);
      const chunkEnd = nextCursor > end ? end : nextCursor;
      process.stdout.write(`  [${dateEntity}] ${cursor} ~ ${chunkEnd} 조회 중... `);
      const rows = await queryRangeEntity(pool, dateEntity, cursor, chunkEnd);
      if (rows.length === 0) {
        console.log("0건");
      } else {
        const result = await upsertForEntity(dateEntity, rows);
        if (!result.success) {
          console.log(`실패: ${result.error}`);
          console.error(
            `중단됨. 재개하려면: npx tsx scripts/backfill-history.ts ${dateEntity} ${cursor} ${end} ${chunkDays ?? ""}`
          );
          process.exit(1);
        }
        totalRows += rows.length;
        totalUpserted += result.inserted + result.updated;
        console.log(`${rows.length}건 조회, ${result.inserted + result.updated}건 반영 (누적 ${totalUpserted}건)`);
      }
      cursor = chunkEnd;
    }
    console.log(`[${dateEntity}] 완료. 총 조회 ${totalRows}건, 반영 ${totalUpserted}건`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
