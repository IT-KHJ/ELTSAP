/**
 * 거래처 현황(판매기준/판매집계) 조회.
 * 데이터: SAP 원본 미러 기반 rpt_delivery_line(취소되지 않은 전체 납품, ELT 부서) / rpt_customer (033_add_rpt_delivery.sql)
 * 기간 전체 합계·거래처별 합계는 서버 함수(rpt_sales_status_json / rpt_sales_status_grouped)에서 계산.
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
  sido?: string | null;
  sigun?: string | null;
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
    sido = null,
    sigun = null,
    salesType = "all",
    offset = 0,
    limit = PAGE_SIZE,
  } = options;

  const admin = getSupabaseAdmin();

  // sido/sigun 필터: 조건에 맞는 거래처코드 목록 조회
  let sidoSigunCodes: string[] | null = null;
  if (sido || sigun) {
    let custQuery = admin.from("rpt_customer").select("cardcode");
    if (sido) custQuery = custQuery.eq("sido", sido);
    if (sigun) custQuery = custQuery.eq("sigun", sigun);
    const { data: matched } = await custQuery;
    const codes = (matched ?? []).map((c: { cardcode: string }) => c.cardcode);
    if (codes.length === 0) {
      return { rows: [], summary: { totalSales: 0, totalReturns: 0, netSales: 0 }, hasMore: false };
    }
    sidoSigunCodes = codes;
  }

  // 기간 전체 합계 + 요청 페이지(limit + 1행, 다음 페이지 유무 판단용)를 한 번에 조회
  const { data, error } = await admin.rpc("rpt_sales_status_json", {
    p_start: startDate,
    p_end: endDate,
    p_cardcode: cardcode && cardcode.trim() ? cardcode.trim() : null,
    p_codes: sidoSigunCodes,
    p_sales_type: salesType,
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as { total_sales?: unknown; total_returns?: unknown; net_sales?: unknown; rows?: OrdersRow[] };
  const pageRows = result.rows ?? [];

  const summary: SalesStatusSummary = {
    totalSales: toNum(result.total_sales) ?? 0,
    totalReturns: toNum(result.total_returns) ?? 0,
    netSales: toNum(result.net_sales) ?? 0,
  };

  const rows = pageRows.slice(0, limit).map(mapOrdersRowToSalesStatusRow);
  const hasMore = pageRows.length > limit;

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
  salesType: "all" | "sales" | "return",
  sido?: string | null,
  sigun?: string | null,
): Promise<{ rows: SalesStatusGroupedRow[] }> {
  const admin = getSupabaseAdmin();

  // sido/sigun 필터: 조건에 맞는 거래처코드 목록 조회
  let sidoSigunCodes: string[] | null = null;
  if (sido || sigun) {
    let custQuery = admin.from("rpt_customer").select("cardcode");
    if (sido) custQuery = custQuery.eq("sido", sido);
    if (sigun) custQuery = custQuery.eq("sigun", sigun);
    const { data: matched } = await custQuery;
    const codes = (matched ?? []).map((c: { cardcode: string }) => c.cardcode);
    if (codes.length === 0) return { rows: [] };
    sidoSigunCodes = codes;
  }

  // 거래처별 합계는 서버에서 계산 (거래처 수만큼의 행만 반환)
  const { data, error } = await admin.rpc("rpt_sales_status_grouped", {
    p_start: startDate,
    p_end: endDate,
    p_sales_type: salesType,
    p_codes: sidoSigunCodes,
  });
  if (error) throw new Error(error.message);

  const rows: SalesStatusGroupedRow[] = ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      basecard: toStr(r.basecard) ?? "",
      cardname: toStr(r.cardname),
      quantity: toNum(r.quantity) ?? 0,
      salesAmount: toNum(r.sales_amount) ?? 0,
      vatAmount: toNum(r.vat_amount) ?? 0,
      totalAmount: toNum(r.total_amount) ?? 0,
      returnAmount: toNum(r.return_amount) ?? 0,
    }))
    .sort((a, b) => (a.basecard || "").localeCompare(b.basecard || ""));

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
    .from("rpt_delivery_line")
    .select("docdate, basecard, cardname, itemcode, itemname, price, supply_rate, discount_rate, quantity, totalsumsy, vatamt, returnamt")
    .gte("docdate", startDate)
    .lte("docdate", endDate)
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
      .order("docentry")
      .order("linenum")
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
