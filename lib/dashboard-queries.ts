/**
 * 거래처 매출 대시보드용 집계.
 * 기존 report-queries와 완전 분리. Supabase 읽기 전용.
 * - 총매출: totalsumsy > 0 합계
 * - 총반품: totalsumsy < 0 합계 (마이너스 표기)
 * - 순매출: 총매출 + 총반품(음수)
 */

import { getSupabaseAdmin } from "./supabase";
import { formatChangePercent } from "./format";
import type {
  DashboardSummary,
  CustomerRankingRow,
  CustomerDetailMonthly,
  CustomerDetailItemSales,
  CustomerDetailItemReturns,
  ParetoRow,
  DashboardInsightRow,
} from "@/types/dashboard";

/** Supabase/PostgREST 기본 최대 1000행. 이보다 크면 첫 페이지만 반환되어 조기 종료됨 */
const SALES_PAGE_SIZE = 1000;

/** 로컬 날짜 YYYY-MM-DD */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD 다음날. docdate(TIMESTAMPTZ)가 endDate 당일 전체를 포함하도록 lt(endDateNextDay) 사용 */
function addDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + 1);
  return toLocalDateString(date);
}

type SalesRowWithItem = {
  basecard: string | null;
  docdate: string | null;
  totalsumsy: number | null;
  itemcode?: string | null;
  quantity?: number | null;
};

/** basecard별 집계 결과 (RPC get_sales_by_basecard 호환) */
interface CardAggregate {
  sales: number;
  returns: number;
  netSales: number;
  orderCount: number;
  lastOrderDate: string | null;
}

/** RPC get_sales_by_basecard 행 → CardAggregate */
function rpcRowToCardAggregate(row: {
  basecard: string | null;
  total_sales: unknown;
  total_returns: unknown;
  net_sales: unknown;
  order_count: unknown;
  last_order_date: string | null;
}): CardAggregate {
  const sales = Number(row.total_sales ?? 0) || 0;
  const returns = Number(row.total_returns ?? 0) || 0;
  const netSales = Number(row.net_sales ?? 0) || 0;
  const orderCount = Math.max(0, Math.floor(Number(row.order_count ?? 0) || 0));
  const lastOrderDate = row.last_order_date ? String(row.last_order_date).slice(0, 10) : null;
  return { sales, returns, netSales, orderCount, lastOrderDate };
}

/** SQL RPC로 basecard별 집계 조회 (fetchAllSalesInRange + aggregateSalesByCard 대체) */
async function fetchSalesByBasecardFromRpc(
  startDate: string,
  endDate: string,
  cardcodeFilter?: string
): Promise<Map<string, CardAggregate>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.rpc("get_sales_by_basecard", {
    p_start: startDate,
    p_end: endDate,
    p_basecard: cardcodeFilter?.trim() || null,
  });
  const rows = (data ?? []) as Array<{
    basecard: string | null;
    total_sales: unknown;
    total_returns: unknown;
    net_sales: unknown;
    order_count: unknown;
    last_order_date: string | null;
  }>;
  const map = new Map<string, CardAggregate>();
  for (const r of rows) {
    const card = (r.basecard ?? "").trim();
    if (!card) continue;
    map.set(card, rpcRowToCardAggregate(r));
  }
  return map;
}

/** report-queries.ts와 동일: Number(x) || 0 패턴. totalsumsy < 0 = 반품 */
function parseTotalsumsy(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

/** Executive Summary: 총매출/총반품은 SQL 집계, 나머지는 기존 로직 */
export async function getDashboardSummary(
  startDate: string,
  endDate: string
): Promise<DashboardSummary> {
  const admin = getSupabaseAdmin();

  const [aggResult, cardAgg] = await Promise.all([
    admin.rpc("get_dashboard_sales_agg", { p_start: startDate, p_end: endDate, p_basecard: null }),
    fetchSalesByBasecardFromRpc(startDate, endDate),
  ]);

  const aggRow = (aggResult.data as { total_sales: number; total_returns: number }[] | null)?.[0];
  const totalSales = Number(aggRow?.total_sales ?? 0) || 0;
  const totalReturns = Number(aggRow?.total_returns ?? 0) || 0;
  const netSales = totalSales + totalReturns;

  const activeCount = cardAgg.size;

  const sorted = Array.from(cardAgg.entries()).sort((a, b) => b[1].sales - a[1].sales);
  const top10Sales = sorted.slice(0, 10).reduce((s, [, a]) => s + a.sales, 0);
  const top10Concentration = totalSales > 0 ? (top10Sales / totalSales) * 100 : 0;

  const prevYearStart = toLocalDateString(new Date(new Date(startDate).getFullYear() - 1, new Date(startDate).getMonth(), 1));
  const prevYearEnd = toLocalDateString(new Date(new Date(endDate).getFullYear() - 1, new Date(endDate).getMonth() + 1, 0));

  const prevYearRes = await admin.rpc("get_dashboard_sales_agg", { p_start: prevYearStart, p_end: prevYearEnd, p_basecard: null });
  const prevYearRow = (prevYearRes.data as { total_sales: number; total_returns: number }[] | null)?.[0];
  const prevYearNet = (Number(prevYearRow?.total_sales ?? 0) || 0) + (Number(prevYearRow?.total_returns ?? 0) || 0);

  const { text: yoyText, isIncrease } = formatChangePercent(netSales, prevYearNet);
  const yoyGrowth = yoyText === "-" ? "-" : `${isIncrease === true ? "▲" : isIncrease === false ? "▼" : ""}${yoyText}`;

  return {
    activeCustomers: activeCount,
    totalSales,
    totalReturns,
    netSales,
    top10Concentration,
    yoyGrowth,
    startDate,
    endDate,
  };
}

/** 거래처 랭킹 (정렬, 필터, 페이지네이션) */
export async function getCustomerRanking(
  startDate: string,
  endDate: string,
  options: {
    cardcode?: string;
    sortBy?: "sales" | "netSales" | "returns" | "returnRate" | "orderCount" | "sharePercent" | "cardname" | "aliasname";
    order?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {}
): Promise<{ rows: CustomerRankingRow[]; totalCount: number; page: number; limit: number }> {
  const { cardcode, sortBy = "sales", order = "desc", page = 1, limit = 10 } = options;

  const prevYearStart = toLocalDateString(new Date(new Date(startDate).getFullYear() - 1, new Date(startDate).getMonth(), 1));
  const prevYearEnd = toLocalDateString(new Date(new Date(endDate).getFullYear() - 1, new Date(endDate).getMonth() + 1, 0));
  const prevMonthStart = toLocalDateString(new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() - 1, 1));
  const prevMonthEnd = toLocalDateString(new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), 0));

  const [curAgg, prevYearAgg, prevMonthAgg] = await Promise.all([
    fetchSalesByBasecardFromRpc(startDate, endDate, cardcode),
    fetchSalesByBasecardFromRpc(prevYearStart, prevYearEnd, cardcode),
    fetchSalesByBasecardFromRpc(prevMonthStart, prevMonthEnd, cardcode),
  ]);

  const admin = getSupabaseAdmin();
  const cardcodes = Array.from(curAgg.keys());
  if (cardcodes.length === 0) {
    return { rows: [], totalCount: 0, page, limit };
  }

  const nameMap: Record<string, { cardname: string | null; aliasname: string | null }> = {};
  for (let i = 0; i < cardcodes.length; i += 500) {
    const chunk = cardcodes.slice(i, i + 500);
    const { data } = await admin.from("customer").select("cardcode, cardname, aliasname").in("cardcode", chunk);
    (data ?? []).forEach((r: { cardcode: string; cardname: string | null; aliasname: string | null }) => {
      nameMap[r.cardcode] = { cardname: r.cardname, aliasname: r.aliasname };
    });
  }

  const totalSalesAll = Array.from(curAgg.values()).reduce((s, a) => s + a.sales, 0);

  const rows: CustomerRankingRow[] = [];
  for (const [code, agg] of Array.from(curAgg.entries())) {
    const prevYear = prevYearAgg.get(code);
    const prevMonth = prevMonthAgg.get(code);
    const orderCount = agg.orderCount;

    const returnRate = agg.sales > 0 ? (Math.abs(agg.returns) / agg.sales) * 100 : 0;
    const sharePercent = totalSalesAll > 0 ? (agg.sales / totalSalesAll) * 100 : 0;

    const { text: yoy } = formatChangePercent(agg.netSales, prevYear?.netSales ?? 0);
    const { text: mom } = formatChangePercent(agg.netSales, prevMonth?.netSales ?? 0);

    rows.push({
      cardcode: code,
      cardname: nameMap[code]?.cardname ?? null,
      aliasname: nameMap[code]?.aliasname ?? null,
      sales: agg.sales,
      netSales: agg.netSales,
      returns: agg.returns,
      returnRate,
      orderCount,
      sharePercent,
      yoy,
      mom,
      rank: 0,
    });
  }

  const sortKey = sortBy;
  rows.sort((a, b) => {
    const aRec = a as unknown as Record<string, string | number | null>;
    const bRec = b as unknown as Record<string, string | number | null>;
    let va: number | string | null = aRec[sortKey];
    let vb: number | string | null = bRec[sortKey];
    if (sortKey === "cardname" || sortKey === "aliasname") {
      va = va ?? "";
      vb = vb ?? "";
      const cmp = String(va).localeCompare(String(vb));
      return order === "desc" ? -cmp : cmp;
    }
    const na = Number(va) || 0;
    const nb = Number(vb) || 0;
    return order === "desc" ? nb - na : na - nb;
  });

  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const totalCount = rows.length;
  const start = (page - 1) * limit;
  const paginated = rows.slice(start, start + limit);

  return { rows: paginated, totalCount, page, limit };
}

async function fetchSalesWithItems(cardcode: string, startDate: string, endDate: string): Promise<SalesRowWithItem[]> {
  const admin = getSupabaseAdmin();
  const out: SalesRowWithItem[] = [];
  let offset = 0;
  const endExclusive = addDay(endDate);
  while (true) {
    const { data } = await admin
      .from("sales")
      .select("basecard, docdate, totalsumsy, itemcode, quantity")
      .eq("basecard", cardcode)
      .or("linestatus.eq.O,linestatus.is.null")
      .gte("docdate", startDate)
      .lt("docdate", endExclusive)
      .range(offset, offset + SALES_PAGE_SIZE - 1);
    const rows = (data ?? []) as SalesRowWithItem[];
    out.push(...rows);
    if (rows.length < SALES_PAGE_SIZE) break;
    offset += SALES_PAGE_SIZE;
  }
  return out;
}

/** 거래처 상세 (기간별 매출, 품목별 매출, 품목별 반품)
 * - monthly: get_sales_by_basecard와 동일 SQL 로직(RPC) 사용
 * - itemSales: fetchSalesWithItems + quantity 합계 (totalsumsy > 0)
 * - itemReturns: fetchSalesWithItems + quantity 합계 (totalsumsy < 0)
 */
export async function getCustomerDetail(
  cardcode: string,
  startDate: string,
  endDate: string
): Promise<{
  monthly: CustomerDetailMonthly[];
  itemSales: CustomerDetailItemSales[];
  itemReturns: CustomerDetailItemReturns[];
  cardname: string | null;
}> {
  const admin = getSupabaseAdmin();

  const [monthlyRpc, rows] = await Promise.all([
    admin.rpc("get_customer_detail_monthly", {
      p_basecard: cardcode,
      p_start: startDate,
      p_end: endDate,
    }),
    fetchSalesWithItems(cardcode, startDate, endDate),
  ]);

  const monthlyRows = (monthlyRpc.data ?? []) as Array<{ month: string; sales: number; returns: number; net_sales: number }>;
  const monthly: CustomerDetailMonthly[] = monthlyRows.map((r) => ({
    month: r.month,
    sales: Number(r.sales ?? 0) || 0,
    returns: Number(r.returns ?? 0) || 0,
    netSales: Number(r.net_sales ?? 0) || 0,
  }));

  const itemMap = new Map<string, { sales: number; quantity: number }>();
  const returnMap = new Map<string, { returns: number; quantity: number }>();
  for (const r of rows) {
    const amt = parseTotalsumsy(r.totalsumsy);
    const qty = Number(r.quantity ?? 0) || 0;
    const item = (r.itemcode ?? "").trim();
    if (item) {
      if (amt > 0) {
        const i = itemMap.get(item) ?? { sales: 0, quantity: 0 };
        i.sales += amt;
        i.quantity += qty;
        itemMap.set(item, i);
      } else if (amt < 0) {
        const i = returnMap.get(item) ?? { returns: 0, quantity: 0 };
        i.returns += amt;
        i.quantity += qty;
        returnMap.set(item, i);
      }
    }
  }

  const allItemCodes = new Set([...Array.from(itemMap.keys()), ...Array.from(returnMap.keys())]);
  const itemNames: Record<string, string | null> = {};
  if (allItemCodes.size > 0) {
    const arr = Array.from(allItemCodes);
    for (let i = 0; i < arr.length; i += 500) {
      const chunk = arr.slice(i, i + 500);
      const { data } = await admin.from("itemlist").select("itemcode, itemname").in("itemcode", chunk);
      (data ?? []).forEach((r: { itemcode: string; itemname: string | null }) => {
        itemNames[r.itemcode] = r.itemname;
      });
    }
  }

  const itemSales: CustomerDetailItemSales[] = Array.from(itemMap.entries())
    .map(([itemcode, v]) => ({
      itemcode,
      itemname: itemNames[itemcode] ?? null,
      sales: v.sales,
      quantity: v.quantity,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 30);

  const itemReturns: CustomerDetailItemReturns[] = Array.from(returnMap.entries())
    .map(([itemcode, v]) => ({
      itemcode,
      itemname: itemNames[itemcode] ?? null,
      returns: v.returns,
      quantity: v.quantity,
    }))
    .sort((a, b) => a.returns - b.returns)
    .slice(0, 30);

  const { data: cust } = await admin.from("customer").select("cardname").eq("cardcode", cardcode).maybeSingle();
  const cardname = (cust as { cardname?: string } | null)?.cardname ?? null;

  return { monthly, itemSales, itemReturns, cardname };
}

/** Pareto (거래처 매출 집중도) - 상위 20위, aliasname 사용 */
export async function getParetoData(
  startDate: string,
  endDate: string
): Promise<ParetoRow[]> {
  const agg = await fetchSalesByBasecardFromRpc(startDate, endDate);
  const admin = getSupabaseAdmin();

  const cardcodes = Array.from(agg.keys());
  const aliasMap: Record<string, string | null> = {};
  if (cardcodes.length > 0) {
    for (let i = 0; i < cardcodes.length; i += 500) {
      const chunk = cardcodes.slice(i, i + 500);
      const { data } = await admin.from("customer").select("cardcode, aliasname").in("cardcode", chunk);
      (data ?? []).forEach((r: { cardcode: string; aliasname: string | null }) => {
        aliasMap[r.cardcode] = r.aliasname;
      });
    }
  }

  const sorted = Array.from(agg.entries()).sort((a, b) => b[1].sales - a[1].sales);
  const totalSales = sorted.reduce((s, [, a]) => s + a.sales, 0);

  let cumulative = 0;
  return sorted.slice(0, 10).map(([cardcode, a], i) => {
    cumulative += a.sales;
    const cumulativePercent = totalSales > 0 ? (cumulative / totalSales) * 100 : 0;
    const sharePercent = totalSales > 0 ? (a.sales / totalSales) * 100 : 0;
    return {
      cardcode,
      aliasname: aliasMap[cardcode] ?? null,
      sales: a.sales,
      cumulativeSales: cumulative,
      cumulativePercent,
      sharePercent,
      rank: i + 1,
    };
  });
}

/** Actionable Insights - 매출 급감, 성장, 반품율 높은 (당기 미주문 제거) */
export async function getDashboardInsights(
  startDate: string,
  endDate: string
): Promise<{
  salesDecline: DashboardInsightRow[];
  highReturnRate: DashboardInsightRow[];
  salesGrowth: DashboardInsightRow[];
}> {
  const prevYearStart = toLocalDateString(new Date(new Date(startDate).getFullYear() - 1, new Date(startDate).getMonth(), 1));
  const prevYearEnd = toLocalDateString(new Date(new Date(endDate).getFullYear() - 1, new Date(endDate).getMonth() + 1, 0));

  const [curAgg, prevYearAgg] = await Promise.all([
    fetchSalesByBasecardFromRpc(startDate, endDate),
    fetchSalesByBasecardFromRpc(prevYearStart, prevYearEnd),
  ]);

  const admin = getSupabaseAdmin();
  const allCards = new Set([...Array.from(curAgg.keys()), ...Array.from(prevYearAgg.keys())]);
  const aliasMap: Record<string, string | null> = {};
  if (allCards.size > 0) {
    const arr = Array.from(allCards);
    for (let i = 0; i < arr.length; i += 500) {
      const chunk = arr.slice(i, i + 500);
      const { data } = await admin.from("customer").select("cardcode, aliasname").in("cardcode", chunk);
      (data ?? []).forEach((r: { cardcode: string; aliasname: string | null }) => {
        aliasMap[r.cardcode] = r.aliasname;
      });
    }
  }

  const salesDecline: DashboardInsightRow[] = [];
  const salesGrowth: DashboardInsightRow[] = [];
  const highReturnRate: DashboardInsightRow[] = [];

  for (const [code, cur] of Array.from(curAgg.entries())) {
    const prev = prevYearAgg.get(code);
    const prevNet = prev?.netSales ?? 0;
    const currNet = cur.netSales;
    const diff = currNet - prevNet;
    const { text: changePct, isIncrease } = formatChangePercent(currNet, prevNet);

    if (prevNet > 0 && diff < 0) {
      salesDecline.push({
        cardcode: code,
        aliasname: aliasMap[code] ?? null,
        prevYear: prevNet,
        currYear: currNet,
        changePercent: changePct,
        changeSymbol: isIncrease === false ? "▼" : isIncrease === true ? "▲" : "-",
      });
    }
    if (prevNet > 0 && diff > 0) {
      salesGrowth.push({
        cardcode: code,
        aliasname: aliasMap[code] ?? null,
        prevYear: prevNet,
        currYear: currNet,
        changePercent: changePct,
        changeSymbol: isIncrease === true ? "▲" : isIncrease === false ? "▼" : "-",
      });
    }
    if (cur.sales > 0 && Math.abs(cur.returns) / cur.sales >= 0.1) {
      const currRetRate = (Math.abs(cur.returns) / cur.sales) * 100;
      const prevReturnAmt = Math.abs(prev?.returns ?? 0);
      const currReturnAmt = Math.abs(cur.returns);
      const changePct = prevReturnAmt > 0 ? ((currReturnAmt - prevReturnAmt) / prevReturnAmt) * 100 : 0;
      highReturnRate.push({
        cardcode: code,
        aliasname: aliasMap[code] ?? null,
        prevYear: prevNet,
        currYear: currNet,
        changePercent: `${currRetRate.toFixed(1)}%`,
        changeSymbol: changePct > 0 ? "▲" : changePct < 0 ? "▼" : "-",
        returnRate: currRetRate,
        prevReturnAmount: prevReturnAmt,
        currReturnAmount: currReturnAmt,
        returnAmountChangePct: changePct,
      });
    }
  }

  salesDecline.sort((a, b) => b.prevYear - a.prevYear);
  salesGrowth.sort((a, b) => (b.currYear - b.prevYear) - (a.currYear - a.prevYear));
  highReturnRate.sort((a, b) => (b.returnAmountChangePct ?? 0) - (a.returnAmountChangePct ?? 0));

  return {
    salesDecline: salesDecline.slice(0, 20),
    highReturnRate: highReturnRate.slice(0, 20),
    salesGrowth: salesGrowth.slice(0, 20),
  };
}
