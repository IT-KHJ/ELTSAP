/**
 * Sales status (판매기준) - Supabase SALES + SAP DLN1 UNION
 */

import { getSupabaseAdmin } from "./supabase";
import { querySapDln1SalesStatus } from "./sap-sqlserver";
import { isSapSqlServerConfigured } from "./sap-sqlserver";
import type { SalesStatusRow, SalesStatusSummary, SalesStatusResponse } from "@/types/sales-status";

const PAGE_SIZE = 100;
const MAX_ROWS_PER_SOURCE = 50000;
const SALES_PAGE_SIZE = 1000;

function toDateStr(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

type SupabaseSalesRow = {
  docdate: string | null;
  basecard: string | null;
  itemcode: string | null;
  quantity: number | null;
  pricebefdi: number | null;
  discprcnt: number | null;
  totalsumsy: number | null;
};

async function fetchSupabaseSales(
  startDate: string,
  endDate: string,
  cardcode: string | null,
  salesType: "all" | "sales" | "return"
): Promise<SalesStatusRow[]> {
  const admin = getSupabaseAdmin();
  const out: SalesStatusRow[] = [];
  let offset = 0;

  let query = admin
    .from("sales")
    .select("docdate, basecard, itemcode, quantity, pricebefdi, discprcnt, totalsumsy")
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", `${startDate}T00:00:00.000Z`)
    .lte("docdate", `${endDate}T23:59:59.999Z`);

  if (cardcode && cardcode.trim()) {
    query = query.ilike("basecard", `%${cardcode.trim()}%`);
  }

  if (salesType === "sales") {
    query = query.gt("totalsumsy", 0);
  } else if (salesType === "return") {
    query = query.lt("totalsumsy", 0);
  }

  const basecards = new Set<string>();
  const itemcodes = new Set<string>();

  while (true) {
    const { data } = await query.order("docdate").order("basecard").order("itemcode").range(offset, offset + SALES_PAGE_SIZE - 1);
    const rows = (data ?? []) as SupabaseSalesRow[];
    if (rows.length === 0) break;

    basecards.clear();
    itemcodes.clear();
    rows.forEach((r) => {
      if (r.basecard) basecards.add(r.basecard);
      if (r.itemcode) itemcodes.add(r.itemcode);
    });

    const customerMap = new Map<string, { cardname: string | null; aliasname: string | null }>();
    if (basecards.size > 0) {
      const { data: customers } = await admin
        .from("customer")
        .select("cardcode, cardname, aliasname")
        .in("cardcode", Array.from(basecards));
      (customers ?? []).forEach((c: { cardcode: string; cardname: string | null; aliasname: string | null }) => {
        customerMap.set(c.cardcode, { cardname: c.cardname ?? null, aliasname: c.aliasname ?? null });
      });
    }

    const itemMap = new Map<string, string | null>();
    if (itemcodes.size > 0) {
      const { data: items } = await admin
        .from("itemlist")
        .select("itemcode, itemname")
        .in("itemcode", Array.from(itemcodes));
      (items ?? []).forEach((i: { itemcode: string; itemname: string | null }) => {
        itemMap.set(i.itemcode, i.itemname ?? null);
      });
    }

    for (const r of rows) {
      const totalsumsy = toNum(r.totalsumsy) ?? 0;
      const discprcnt = toNum(r.discprcnt) ?? 0;
      const pricebefdi = toNum(r.pricebefdi) ?? 0;
      const cust = r.basecard ? customerMap.get(r.basecard) : null;
      const itemname = r.itemcode ? itemMap.get(r.itemcode) ?? null : null;

      out.push({
        docdate: toDateStr(r.docdate),
        basecard: toStr(r.basecard) ?? "",
        cardname: cust?.cardname ?? null,
        aliasname: cust?.aliasname ?? null,
        itemcode: toStr(r.itemcode),
        itemname,
        price: pricebefdi,
        supplyRate: Math.round(100 - discprcnt),
        discountRate: Math.round(discprcnt),
        quantity: toNum(r.quantity),
        salesAmount: totalsumsy > 0 ? totalsumsy : 0,
        returnAmount: totalsumsy < 0 ? Math.abs(totalsumsy) : 0,
        netSales: totalsumsy,
      });
    }

    if (rows.length < SALES_PAGE_SIZE || out.length >= MAX_ROWS_PER_SOURCE) break;
    offset += SALES_PAGE_SIZE;
  }

  return out;
}

function mapSapRowToSalesStatusRow(r: Record<string, unknown>): SalesStatusRow {
  const totalsumsy = toNum(r.totalsumsy) ?? 0;
  const returnamt = toNum(r.returnamt) ?? 0;
  const salesAmount = totalsumsy > 0 ? totalsumsy : 0;
  const returnAmount = totalsumsy < 0 ? Math.abs(totalsumsy) : returnamt;
  const docdate = toDateStr(r.docdate);
  const docdateFormatted = docdate.length === 8 ? `${docdate.slice(0, 4)}-${docdate.slice(4, 6)}-${docdate.slice(6, 8)}` : docdate;

  return {
    docdate: docdateFormatted,
    basecard: toStr(r.basecard) ?? "",
    cardname: toStr(r.cardname),
    aliasname: toStr(r.aliasname),
    itemcode: toStr(r.itemcode),
    itemname: toStr(r.itemname),
    price: toNum(r.price),
    supplyRate: toNum(r.supply_rate),
    discountRate: toNum(r.discount_rate),
    quantity: toNum(r.quantity),
    salesAmount,
    returnAmount,
    netSales: totalsumsy,
  };
}

export interface GetSalesStatusOptions {
  startDate: string;
  endDate: string;
  cardcode?: string | null;
  salesType?: "all" | "sales" | "return";
  offset?: number;
  limit?: number;
}

export async function getSalesStatus(options: GetSalesStatusOptions): Promise<SalesStatusResponse> {
  const {
    startDate,
    endDate,
    cardcode = null,
    salesType = "all",
    offset = 0,
    limit = PAGE_SIZE,
  } = options;

  let sapRows: SalesStatusRow[] = [];
  let sapFetchFailed = false;
  let sapError: string | undefined;

  const [supabaseRows] = await Promise.all([
    fetchSupabaseSales(startDate, endDate, cardcode ?? null, salesType),
    (async () => {
      if (!isSapSqlServerConfigured()) {
        sapFetchFailed = true;
        sapError = "SAP SQL Server 연결 정보가 설정되지 않았습니다.";
        return;
      }
      try {
        const raw = await querySapDln1SalesStatus(startDate, endDate, cardcode ?? undefined);
        const filtered =
          salesType === "sales"
            ? raw.filter((r) => (Number(r.totalsumsy) ?? 0) > 0)
            : salesType === "return"
              ? raw.filter((r) => (Number(r.totalsumsy) ?? 0) < 0)
              : raw;
        sapRows = filtered.slice(0, MAX_ROWS_PER_SOURCE).map(mapSapRowToSalesStatusRow);
      } catch (e) {
        sapFetchFailed = true;
        sapError = e instanceof Error ? e.message : String(e);
      }
    })(),
  ]);

  const merged = [...supabaseRows, ...sapRows].sort((a, b) => {
    const d = (a.docdate || "").localeCompare(b.docdate || "");
    if (d !== 0) return d;
    const c = (a.basecard || "").localeCompare(b.basecard || "");
    if (c !== 0) return c;
    return (a.itemcode || "").localeCompare(b.itemcode || "");
  });

  const summary: SalesStatusSummary = {
    totalSales: merged.reduce((s, r) => s + (r.salesAmount ?? 0), 0),
    totalReturns: merged.reduce((s, r) => s + (r.returnAmount ?? 0), 0),
    netSales: merged.reduce((s, r) => s + (r.netSales ?? 0), 0),
  };

  const rows = merged.slice(offset, offset + limit);
  const hasMore = merged.length > offset + limit;

  const result: SalesStatusResponse = {
    rows,
    summary,
    hasMore,
  };
  if (sapFetchFailed) {
    result.sapFetchFailed = true;
    result.sapError = sapError;
  }
  return result;
}
