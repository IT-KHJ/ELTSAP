/**
 * B안 거래처 현황(판매기준) 그룹화 조회 - Supabase RPC + SAP DLN1 그룹화
 * A안(sales-status-queries)과 독립. B안 전용.
 */

import { getSupabaseAdmin } from "./supabase";
import { querySapDln1SalesStatusGrouped, querySapDln1SalesStatus } from "./sap-sqlserver";
import { isSapSqlServerConfigured } from "./sap-sqlserver";

export interface SalesStatusGroupedRow {
  basecard: string;
  cardname: string | null;
  quantity: number;
  salesAmount: number;
  vatAmount: number;
  totalAmount: number;
  returnAmount: number;
}

export interface SalesStatusGroupedResponse {
  rows: SalesStatusGroupedRow[];
  sapFetchFailed?: boolean;
  sapError?: string;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function getSalesStatusGrouped(
  startDate: string,
  endDate: string,
  salesType: "all" | "sales" | "return"
): Promise<SalesStatusGroupedResponse> {
  let sapRows: SalesStatusGroupedRow[] = [];
  let sapFetchFailed = false;
  let sapError: string | undefined;

  const [supabaseRows] = await Promise.all([
    (async () => {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.rpc("get_sales_status_grouped", {
        p_start: startDate,
        p_end: endDate,
        p_sales_type: salesType,
      });
      if (error) return [];
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        basecard: toStr(r.basecard) ?? "",
        cardname: toStr(r.cardname),
        quantity: toNum(r.quantity),
        salesAmount: toNum(r.sales_amount),
        vatAmount: toNum(r.vat_amount),
        totalAmount: toNum(r.total_amount),
        returnAmount: toNum(r.return_amount),
      }));
    })(),
    (async () => {
      if (!isSapSqlServerConfigured()) {
        sapFetchFailed = true;
        sapError = "SAP SQL Server 연결 정보가 설정되지 않았습니다.";
        return;
      }
      try {
        const raw = await querySapDln1SalesStatusGrouped(startDate, endDate, salesType);
        sapRows = raw.map((r) => ({
          basecard: toStr(r.basecard) ?? "",
          cardname: toStr(r.cardname),
          quantity: toNum(r.quantity),
          salesAmount: toNum(r.sales_amount),
          vatAmount: toNum(r.vat_amount),
          totalAmount: toNum(r.total_amount),
          returnAmount: toNum(r.return_amount),
        }));
      } catch (e) {
        sapFetchFailed = true;
        sapError = e instanceof Error ? e.message : String(e);
      }
    })(),
  ]);

  const merged = new Map<string, SalesStatusGroupedRow>();
  for (const r of supabaseRows) {
    merged.set(r.basecard, { ...r });
  }
  for (const r of sapRows) {
    const existing = merged.get(r.basecard);
    if (existing) {
      existing.quantity += r.quantity;
      existing.salesAmount += r.salesAmount;
      existing.vatAmount += r.vatAmount;
      existing.totalAmount += r.totalAmount;
      existing.returnAmount += r.returnAmount;
    } else {
      merged.set(r.basecard, { ...r });
    }
  }

  const rows = Array.from(merged.values()).sort((a, b) =>
    (a.basecard || "").localeCompare(b.basecard || "")
  );

  const result: SalesStatusGroupedResponse = { rows };
  if (sapFetchFailed) {
    result.sapFetchFailed = true;
    result.sapError = sapError;
  }
  return result;
}

/** B안 상세 행 - vatAmount, totalAmount 포함 (자세히보기용) */
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

const SALES_PAGE_SIZE = 1000;

type SupabaseSalesDetailRow = {
  docdate: string | null;
  basecard: string | null;
  itemcode: string | null;
  quantity: number | null;
  pricebefdi: number | null;
  discprcnt: number | null;
  totalsumsy: number | null;
  vatsumsy: number | null;
};

function toDateStr(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export async function getSalesStatusDetail(
  startDate: string,
  endDate: string,
  cardcode: string,
  salesType: "all" | "sales" | "return"
): Promise<SalesStatusDetailRow[]> {
  const admin = getSupabaseAdmin();
  const out: SalesStatusDetailRow[] = [];
  let offset = 0;

  let query = admin
    .from("sales")
    .select("docdate, basecard, itemcode, quantity, pricebefdi, discprcnt, totalsumsy, vatsumsy")
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", `${startDate}T00:00:00.000Z`)
    .lte("docdate", `${endDate}T23:59:59.999Z`)
    .ilike("basecard", cardcode);

  if (salesType === "sales") {
    query = query.gt("totalsumsy", 0);
  } else if (salesType === "return") {
    query = query.lt("totalsumsy", 0);
  }

  const basecards = new Set<string>([cardcode]);
  const itemcodes = new Set<string>();

  while (true) {
    const { data } = await query
      .order("docdate")
      .order("basecard")
      .order("itemcode")
      .range(offset, offset + SALES_PAGE_SIZE - 1);
    const rows = (data ?? []) as SupabaseSalesDetailRow[];
    if (rows.length === 0) break;

    itemcodes.clear();
    rows.forEach((r) => {
      if (r.itemcode) itemcodes.add(r.itemcode);
    });

    const customerMap = new Map<string, { cardname: string | null }>();
    const { data: customers } = await admin
      .from("customer")
      .select("cardcode, cardname")
      .in("cardcode", Array.from(basecards));
    (customers ?? []).forEach((c: { cardcode: string; cardname: string | null }) => {
      customerMap.set(c.cardcode, { cardname: c.cardname ?? null });
    });

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
      const totalsumsy = toNum(r.totalsumsy);
      const discprcnt = toNum(r.discprcnt);
      const cust = r.basecard ? customerMap.get(r.basecard) : null;
      const itemname = r.itemcode ? itemMap.get(r.itemcode) ?? null : null;

      out.push({
        docdate: toDateStr(r.docdate),
        basecard: toStr(r.basecard) ?? "",
        cardname: cust?.cardname ?? null,
        itemcode: toStr(r.itemcode),
        itemname,
        price: r.pricebefdi != null ? toNum(r.pricebefdi) : null,
        supplyRate: Math.round(100 - discprcnt),
        discountRate: Math.round(discprcnt),
        quantity: r.quantity != null ? toNum(r.quantity) : null,
        salesAmount: totalsumsy > 0 ? totalsumsy : 0,
        vatAmount: r.vatsumsy != null ? toNum(r.vatsumsy) : null,
        totalAmount: r.vatsumsy != null ? totalsumsy + toNum(r.vatsumsy) : null,
        returnAmount: totalsumsy < 0 ? Math.abs(totalsumsy) : 0,
        netSales: totalsumsy,
      });
    }

    if (rows.length < SALES_PAGE_SIZE) break;
    offset += SALES_PAGE_SIZE;
  }

  let sapRows: SalesStatusDetailRow[] = [];
  if (isSapSqlServerConfigured()) {
    try {
      const raw = await querySapDln1SalesStatus(startDate, endDate, cardcode);
      const filtered =
        salesType === "sales"
          ? raw.filter((r) => (Number(r.totalsumsy) ?? 0) > 0)
          : salesType === "return"
            ? raw.filter((r) => (Number(r.totalsumsy) ?? 0) < 0)
            : raw;
      const docdateFmt = (v: unknown) => {
        const s = String(v ?? "").replace(/-/g, "").replace(/\D/g, "");
        return s.length >= 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : String(v ?? "");
      };
      sapRows = filtered.map((r) => {
        const totalsumsy = toNum(r.totalsumsy);
        const vatamt = r.vatamt != null ? toNum(r.vatamt) : null;
        return {
          docdate: docdateFmt(r.docdate),
          basecard: toStr(r.basecard) ?? "",
          cardname: toStr(r.cardname),
          itemcode: toStr(r.itemcode),
          itemname: toStr(r.itemname),
          price: r.price != null ? toNum(r.price) : null,
          supplyRate: r.supply_rate != null ? toNum(r.supply_rate) : null,
          discountRate: r.discount_rate != null ? toNum(r.discount_rate) : null,
          quantity: r.quantity != null ? toNum(r.quantity) : null,
          salesAmount: totalsumsy > 0 ? totalsumsy : 0,
          vatAmount: vatamt,
          totalAmount: vatamt != null ? totalsumsy + vatamt : null,
          returnAmount: totalsumsy < 0 ? Math.abs(totalsumsy) : 0,
          netSales: totalsumsy,
        };
      });
    } catch {
      // SAP 실패 시 Supabase만 반환
    }
  }

  const merged = [...out, ...sapRows].sort((a, b) => {
    const d = (a.docdate || "").localeCompare(b.docdate || "");
    if (d !== 0) return d;
    return (a.itemcode || "").localeCompare(b.itemcode || "");
  });
  return merged;
}
