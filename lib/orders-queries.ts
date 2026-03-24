/**
 * Supabase orders 테이블 기반 거래처 현황 조회.
 * 판매기준/판매집계 기본 데이터 소스.
 */

import { getSupabaseAdmin } from "./supabase";
import type { SalesStatusRow, SalesStatusSummary, SalesStatusResponse } from "@/types/sales-status";

const PAGE_SIZE = 100;
const ORDERS_PAGE_SIZE = 1000;

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

type OrdersRow = {
  docdate: string | null;
  basecard: string | null;
  cardname: string | null;
  aliasname: string | null;
  itemcode: string | null;
  itemname: string | null;
  price: number | null;
  supply_rate: number | null;
  discount_rate: number | null;
  quantity: number | null;
  totalsumsy: number | null;
  vatamt: number | null;
  returnamt: number | null;
};

function mapOrdersRowToSalesStatusRow(r: OrdersRow): SalesStatusRow {
  const totalsumsy = toNum(r.totalsumsy) ?? 0;
  return {
    docdate: toDateStr(r.docdate),
    basecard: toStr(r.basecard) ?? "",
    cardname: toStr(r.cardname),
    aliasname: toStr(r.aliasname),
    itemcode: toStr(r.itemcode),
    itemname: toStr(r.itemname),
    price: toNum(r.price),
    supplyRate: toNum(r.supply_rate),
    discountRate: toNum(r.discount_rate),
    quantity: toNum(r.quantity),
    salesAmount: totalsumsy > 0 ? totalsumsy : 0,
    returnAmount: totalsumsy < 0 ? Math.abs(totalsumsy) : (toNum(r.returnamt) ?? 0),
    netSales: totalsumsy,
  };
}

export interface GetSalesStatusFromOrdersOptions {
  startDate: string;
  endDate: string;
  cardcode?: string | null;
  salesType?: "all" | "sales" | "return";
  offset?: number;
  limit?: number;
}

export async function getSalesStatusFromOrders(
  options: GetSalesStatusFromOrdersOptions
): Promise<SalesStatusResponse> {
  const {
    startDate,
    endDate,
    cardcode = null,
    salesType = "all",
    offset = 0,
    limit = PAGE_SIZE,
  } = options;

  const admin = getSupabaseAdmin();
  const out: SalesStatusRow[] = [];
  let pageOffset = 0;

  let query = admin
    .from("orders")
    .select("docdate, basecard, cardname, aliasname, itemcode, itemname, price, supply_rate, discount_rate, quantity, totalsumsy, vatamt, returnamt")
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

  while (true) {
    const { data } = await query
      .order("docdate")
      .order("basecard")
      .order("itemcode")
      .range(pageOffset, pageOffset + ORDERS_PAGE_SIZE - 1);
    const rows = (data ?? []) as OrdersRow[];
    if (rows.length === 0) break;
    out.push(...rows.map(mapOrdersRowToSalesStatusRow));
    if (rows.length < ORDERS_PAGE_SIZE) break;
    pageOffset += ORDERS_PAGE_SIZE;
  }

  const summary: SalesStatusSummary = {
    totalSales: out.reduce((s, r) => s + (r.salesAmount ?? 0), 0),
    totalReturns: out.reduce((s, r) => s + (r.returnAmount ?? 0), 0),
    netSales: out.reduce((s, r) => s + (r.netSales ?? 0), 0),
  };

  const rows = out.slice(offset, offset + limit);
  const hasMore = out.length > offset + limit;

  return { rows, summary, hasMore };
}

export interface SalesStatusGroupedRow {
  basecard: string;
  cardname: string | null;
  quantity: number;
  salesAmount: number;
  vatAmount: number;
  totalAmount: number;
  returnAmount: number;
}

export async function getSalesStatusGroupedFromOrders(
  startDate: string,
  endDate: string,
  salesType: "all" | "sales" | "return"
): Promise<{ rows: SalesStatusGroupedRow[] }> {
  const admin = getSupabaseAdmin();
  const out: OrdersRow[] = [];
  let pageOffset = 0;

  let query = admin
    .from("orders")
    .select("basecard, cardname, quantity, totalsumsy, vatamt, returnamt")
    .gte("docdate", `${startDate}T00:00:00.000Z`)
    .lte("docdate", `${endDate}T23:59:59.999Z`);

  if (salesType === "sales") {
    query = query.gt("totalsumsy", 0);
  } else if (salesType === "return") {
    query = query.lt("totalsumsy", 0);
  }

  while (true) {
    const { data } = await query.order("basecard").range(pageOffset, pageOffset + ORDERS_PAGE_SIZE - 1);
    const rows = (data ?? []) as OrdersRow[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < ORDERS_PAGE_SIZE) break;
    pageOffset += ORDERS_PAGE_SIZE;
  }

  const grouped = new Map<string, SalesStatusGroupedRow>();
  for (const r of out) {
    const key = toStr(r.basecard) ?? "";
    if (!key) continue;
    const existing = grouped.get(key);
    const qty = toNum(r.quantity) ?? 0;
    const totalsumsy = toNum(r.totalsumsy) ?? 0;
    const vatamt = toNum(r.vatamt) ?? 0;
    const returnamt = toNum(r.returnamt) ?? 0;
    if (existing) {
      existing.quantity += qty;
      existing.salesAmount += totalsumsy;
      existing.vatAmount += vatamt;
      existing.totalAmount += totalsumsy + vatamt;
      existing.returnAmount += returnamt;
    } else {
      grouped.set(key, {
        basecard: key,
        cardname: toStr(r.cardname),
        quantity: qty,
        salesAmount: totalsumsy,
        vatAmount: vatamt,
        totalAmount: totalsumsy + vatamt,
        returnAmount: returnamt,
      });
    }
  }

  const rows = Array.from(grouped.values()).sort((a, b) =>
    (a.basecard || "").localeCompare(b.basecard || "")
  );

  return { rows };
}

export interface SalesStatusDetailRow {
  docdate: string;
  basecard: string;
  cardname: string | null;
  itemcode: string | null;
  itemname: string | null;
  price: number | null;
  supplyRate: number | null;
  discountRate: number | null;
  quantity: number | null;
  salesAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  returnAmount: number | null;
  netSales: number | null;
}

export async function getSalesStatusDetailFromOrders(
  startDate: string,
  endDate: string,
  cardcode: string,
  salesType: "all" | "sales" | "return"
): Promise<SalesStatusDetailRow[]> {
  const admin = getSupabaseAdmin();
  const out: OrdersRow[] = [];
  let pageOffset = 0;

  let query = admin
    .from("orders")
    .select("docdate, basecard, cardname, itemcode, itemname, price, supply_rate, discount_rate, quantity, totalsumsy, vatamt, returnamt")
    .gte("docdate", `${startDate}T00:00:00.000Z`)
    .lte("docdate", `${endDate}T23:59:59.999Z`)
    .ilike("basecard", cardcode);

  if (salesType === "sales") {
    query = query.gt("totalsumsy", 0);
  } else if (salesType === "return") {
    query = query.lt("totalsumsy", 0);
  }

  while (true) {
    const { data } = await query
      .order("docdate")
      .order("itemcode")
      .range(pageOffset, pageOffset + ORDERS_PAGE_SIZE - 1);
    const rows = (data ?? []) as OrdersRow[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < ORDERS_PAGE_SIZE) break;
    pageOffset += ORDERS_PAGE_SIZE;
  }

  return out.map((r) => {
    const totalsumsy = toNum(r.totalsumsy) ?? 0;
    const vatamt = toNum(r.vatamt);
    return {
      docdate: toDateStr(r.docdate),
      basecard: toStr(r.basecard) ?? "",
      cardname: toStr(r.cardname),
      itemcode: toStr(r.itemcode),
      itemname: toStr(r.itemname),
      price: toNum(r.price),
      supplyRate: toNum(r.supply_rate),
      discountRate: toNum(r.discount_rate),
      quantity: toNum(r.quantity),
      salesAmount: totalsumsy > 0 ? totalsumsy : 0,
      vatAmount: vatamt,
      totalAmount: vatamt != null ? totalsumsy + vatamt : null,
      returnAmount: totalsumsy < 0 ? Math.abs(totalsumsy) : 0,
      netSales: totalsumsy,
    };
  });
}
