/**
 * 거래처 현황 보고서용 집계.
 * 월 단위 집계는 서버 SQL로 처리, 클라이언트 reduce 금지.
 */

import { getSupabaseAdmin } from "./supabase";
import {
  CATEGORY_BG,
  CATEGORY_OUP,
  LABEL_BG,
  LABEL_OUP,
  MONTHS,
} from "./constants";
import type { MonthlyAmount, SalesByCategory, TopItemRow, TopBrandRow } from "@/types/report";
import { formatChangePercent } from "./format";

function emptyMonthly(): MonthlyAmount {
  const o: MonthlyAmount = { total: 0 } as MonthlyAmount;
  MONTHS.forEach((m) => ((o as unknown as Record<string, number>)[String(m)] = 0));
  return o;
}

const SALES_PAGE_SIZE = 1000;

/** Supabase 기본 1000행 제한을 넘기 위해 SALES 전체 조회 (페이지네이션) */
type SalesRow = { docdate: string | null; totalsumsy: number | null; itemcode: string | null };
async function fetchAllSales(
  admin: ReturnType<typeof getSupabaseAdmin>,
  cardcode: string,
  startDate: string,
  endDate: string
): Promise<SalesRow[]> {
  const out: SalesRow[] = [];
  let offset = 0;
  while (true) {
    const { data } = await admin
      .from("SALES")
      .select("docdate, totalsumsy, itemcode")
      .eq("basecard", cardcode)
      .gte("docdate", startDate)
      .lte("docdate", endDate)
      .range(offset, offset + SALES_PAGE_SIZE - 1);
    const rows = (data ?? []) as SalesRow[];
    out.push(...rows);
    if (rows.length < SALES_PAGE_SIZE) break;
    offset += SALES_PAGE_SIZE;
  }
  return out;
}

type SalesQtyRow = { itemcode: string | null; quantity: number | null };
async function fetchAllSalesQty(
  admin: ReturnType<typeof getSupabaseAdmin>,
  cardcode: string,
  startDate: string,
  endDate: string
): Promise<SalesQtyRow[]> {
  const out: SalesQtyRow[] = [];
  let offset = 0;
  while (true) {
    const { data } = await admin
      .from("SALES")
      .select("itemcode, quantity")
      .eq("basecard", cardcode)
      .gte("docdate", startDate)
      .lte("docdate", endDate)
      .range(offset, offset + SALES_PAGE_SIZE - 1);
    const rows = (data ?? []) as SalesQtyRow[];
    out.push(...rows);
    if (rows.length < SALES_PAGE_SIZE) break;
    offset += SALES_PAGE_SIZE;
  }
  return out;
}

/** docdate 문자열(YYYY-MM-DD 또는 ISO)에서 월만 추출. 타임존/시간 영향 제거 */
function monthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return "1";
  const month = parseInt(dateStr.slice(5, 7), 10);
  return String(month >= 1 && month <= 12 ? month : 1);
}

/** SALES + ITEMLIST 조인, basecard + 기간, itmsgrpcod별 월별 totalsumsy 합계 */
export async function getSalesByCategory(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string
): Promise<SalesByCategory[]> {
  const admin = getSupabaseAdmin();
  const [current, previous] = await Promise.all([
    fetchAllSales(admin, cardcode, startDate, endDate),
    fetchAllSales(admin, cardcode, previousStart, previousEnd),
  ]);

  const itemCodes = new Set<string>();
  current.forEach((r) => r.itemcode && itemCodes.add(r.itemcode));
  previous.forEach((r) => r.itemcode && itemCodes.add(r.itemcode));

  if (itemCodes.size === 0) {
    return [
      { categoryCode: CATEGORY_BG, categoryLabel: LABEL_BG, currentYear: emptyMonthly(), previousYear: emptyMonthly(), changePercent: {} },
      { categoryCode: CATEGORY_OUP, categoryLabel: LABEL_OUP, currentYear: emptyMonthly(), previousYear: emptyMonthly(), changePercent: {} },
    ];
  }

  const { data: itemsRaw } = await admin
    .from("ITEMLIST")
    .select("itemcode, itmsgrpcod")
    .in("itemcode", Array.from(itemCodes));

  type ItemRow = { itemcode: string; itmsgrpcod: number | null };
  const items = (itemsRaw ?? []) as ItemRow[];
  const mapItemGroup: Record<string, number> = {};
  items.forEach((r) => {
    mapItemGroup[r.itemcode] = r.itmsgrpcod ?? 0;
  });

  const toMonthly = (rows: { docdate: string | null; totalsumsy: number | null }[]) => {
    const m = emptyMonthly();
    let total = 0;
    (rows || []).forEach((r) => {
      const amt = Number(r.totalsumsy) || 0;
      total += amt;
      if (r.docdate) {
        const k = monthKey(r.docdate);
        (m as unknown as Record<string, number>)[k] = ((m as unknown as Record<string, number>)[k] || 0) + amt;
      }
    });
    m.total = total;
    return m;
  };

  const byCategory = (
    rows: { docdate: string | null; totalsumsy: number | null; itemcode: string | null }[]
  ) => {
    const bg: { docdate: string | null; totalsumsy: number | null }[] = [];
    const oup: { docdate: string | null; totalsumsy: number | null }[] = [];
    const etc: { docdate: string | null; totalsumsy: number | null }[] = [];
    rows.forEach((r) => {
      const code = String(mapItemGroup[r.itemcode ?? ""] ?? "");
      const row = { docdate: r.docdate, totalsumsy: r.totalsumsy };
      if (code === CATEGORY_BG) bg.push(row);
      else if (code === CATEGORY_OUP) oup.push(row);
      else etc.push(row);
    });
    return { bg, oup, etc };
  };

  const cur = byCategory(current);
  const prev = byCategory(previous);

  const result: SalesByCategory[] = [
    {
      categoryCode: CATEGORY_BG,
      categoryLabel: LABEL_BG,
      currentYear: toMonthly(cur.bg),
      previousYear: toMonthly(prev.bg),
      changePercent: {},
    },
    {
      categoryCode: CATEGORY_OUP,
      categoryLabel: LABEL_OUP,
      currentYear: toMonthly(cur.oup),
      previousYear: toMonthly(prev.oup),
      changePercent: {},
    },
  ];

  result.forEach((cat) => {
    const c = cat.currentYear;
    const p = cat.previousYear;
    MONTHS.forEach((month) => {
      const key = String(month);
      const cv = (c as unknown as Record<string, number>)[key] ?? 0;
      const pv = (p as unknown as Record<string, number>)[key] ?? 0;
      const { text } = formatChangePercent(cv, pv);
      (cat.changePercent as Record<string, string>)[key] = text;
    });
    (cat.changePercent as Record<string, string>).total = formatChangePercent(c.total, p.total).text;
  });

  return result;
}

/** INAMT 월별 합계 */
export async function getInamtMonthly(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string
) {
  const admin = getSupabaseAdmin();
  const { data: currentRaw } = await admin
    .from("INAMT")
    .select("docdate, doctotal")
    .eq("cardcode", cardcode)
    .gte("docdate", startDate)
    .lte("docdate", endDate);

  const { data: previousRaw } = await admin
    .from("INAMT")
    .select("docdate, doctotal")
    .eq("cardcode", cardcode)
    .gte("docdate", previousStart)
    .lte("docdate", previousEnd);

  type InamtRow = { docdate: string | null; doctotal: number | null };
  const current = (currentRaw ?? []) as InamtRow[];
  const previous = (previousRaw ?? []) as InamtRow[];

  const toMonthly = (rows: InamtRow[]) => {
    const m = emptyMonthly();
    let total = 0;
    rows.forEach((r) => {
      const amt = Number(r.doctotal) || 0;
      total += amt;
      if (r.docdate) {
        const k = monthKey(r.docdate);
        (m as unknown as Record<string, number>)[k] = ((m as unknown as Record<string, number>)[k] || 0) + amt;
      }
    });
    m.total = total;
    return m;
  };

  const cur = toMonthly(current);
  const prev = toMonthly(previous);
  const changePercent: Record<string, string> = { total: formatChangePercent(cur.total, prev.total).text };
  MONTHS.forEach((m) => {
    const key = String(m);
    changePercent[key] = formatChangePercent(
      (cur as unknown as Record<string, number>)[key] ?? 0,
      (prev as unknown as Record<string, number>)[key] ?? 0
    ).text;
  });

  return { currentYear: cur, previousYear: prev, changePercent };
}

/** SALEETC 증정 수량 월별 */
export async function getGiftQtyMonthly(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string
) {
  const admin = getSupabaseAdmin();
  const { data: currentRaw } = await admin
    .from("SALEETC")
    .select("docdate, quantity")
    .eq("basecard", cardcode)
    .gte("docdate", startDate)
    .lte("docdate", endDate);

  const { data: previousRaw } = await admin
    .from("SALEETC")
    .select("docdate, quantity")
    .eq("basecard", cardcode)
    .gte("docdate", previousStart)
    .lte("docdate", previousEnd);

  type SaleetcQtyRow = { docdate: string | null; quantity: number | null };
  const current = (currentRaw ?? []) as SaleetcQtyRow[];
  const previous = (previousRaw ?? []) as SaleetcQtyRow[];

  const toMonthly = (rows: SaleetcQtyRow[]) => {
    const m = emptyMonthly();
    let total = 0;
    rows.forEach((r) => {
      const q = Number(r.quantity) || 0;
      total += q;
      if (r.docdate) {
        const k = monthKey(r.docdate);
        (m as unknown as Record<string, number>)[k] = ((m as unknown as Record<string, number>)[k] || 0) + q;
      }
    });
    m.total = total;
    return m;
  };

  const cur = toMonthly(current);
  const prev = toMonthly(previous);
  const changePercent: Record<string, string> = { total: formatChangePercent(cur.total, prev.total).text };
  MONTHS.forEach((m) => {
    const key = String(m);
    changePercent[key] = formatChangePercent(
      (cur as unknown as Record<string, number>)[key] ?? 0,
      (prev as unknown as Record<string, number>)[key] ?? 0
    ).text;
  });

  return { currentYear: cur, previousYear: prev, changePercent };
}

/** 주요 품목 판매 (품목별 수량 합계, 전년 비교) */
export async function getTopItems(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string,
  limit: number = 20
): Promise<TopItemRow[]> {
  const admin = getSupabaseAdmin();
  const [current, previous] = await Promise.all([
    fetchAllSalesQty(admin, cardcode, startDate, endDate),
    fetchAllSalesQty(admin, cardcode, previousStart, previousEnd),
  ]);

  const curMap: Record<string, number> = {};
  current.forEach((r) => {
    const code = r.itemcode ?? "";
    curMap[code] = (curMap[code] || 0) + (Number(r.quantity) || 0);
  });
  const prevMap: Record<string, number> = {};
  previous.forEach((r) => {
    const code = r.itemcode ?? "";
    prevMap[code] = (prevMap[code] || 0) + (Number(r.quantity) || 0);
  });

  const allCodes = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
  if (allCodes.size === 0) return [];

  const { data: namesRaw } = await admin
    .from("ITEMLIST")
    .select("itemcode, itemname")
    .in("itemcode", Array.from(allCodes));

  type NameRow = { itemcode: string; itemname: string | null };
  const names = (namesRaw ?? []) as NameRow[];
  const nameMap: Record<string, string> = {};
  names.forEach((r) => (nameMap[r.itemcode] = r.itemname ?? r.itemcode));

  const rows: TopItemRow[] = [];
  allCodes.forEach((itemcode) => {
    const qtyCurrent = curMap[itemcode] ?? 0;
    const qtyPrevious = prevMap[itemcode] ?? 0;
    const { text, isIncrease } = formatChangePercent(qtyCurrent, qtyPrevious);
    rows.push({
      itemcode,
      itemname: nameMap[itemcode] ?? itemcode,
      qtyCurrent,
      qtyPrevious,
      changePercent: text,
      isIncrease,
    });
  });

  rows.sort((a, b) => b.qtyCurrent - a.qtyCurrent);
  return rows.slice(0, limit);
}

const ITEMLIST_BATCH_SIZE = 500;

/** 주요품목 판매 현황 - brand별 집계 (SALES.itemcode = ITEMLIST.itemcode, SUM(quantity)) */
export async function getTopBrands(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string,
  limit: number = 20
): Promise<TopBrandRow[]> {
  const admin = getSupabaseAdmin();
  const [current, previous] = await Promise.all([
    fetchAllSalesQty(admin, cardcode, startDate, endDate),
    fetchAllSalesQty(admin, cardcode, previousStart, previousEnd),
  ]);

  const allCodes = new Set<string>();
  current.forEach((r) => {
    const code = (r.itemcode ?? "").trim();
    if (code) allCodes.add(code);
  });
  previous.forEach((r) => {
    const code = (r.itemcode ?? "").trim();
    if (code) allCodes.add(code);
  });
  if (allCodes.size === 0) return [];

  const codesArr = Array.from(allCodes);
  const itemToBrand: Record<string, string> = {}; // itemgb = '0101' 인 품목만 포함
  for (let i = 0; i < codesArr.length; i += ITEMLIST_BATCH_SIZE) {
    const chunk = codesArr.slice(i, i + ITEMLIST_BATCH_SIZE);
    const { data: itemsRaw } = await admin
      .from("ITEMLIST")
      .select("itemcode, brand")
      .in("itemcode", chunk)
      .eq("itemgb", "0101");
    type ItemBrandRow = { itemcode: string; brand: string | null };
    (itemsRaw ?? []).forEach((r: ItemBrandRow) => {
      const code = (r.itemcode ?? "").trim();
      const key = code.toUpperCase();
      if (key && !itemToBrand[key]) itemToBrand[key] = (r.brand ?? "").trim() || "미지정";
    });
  }

  const curSum: Record<string, number> = {};
  current.forEach((r) => {
    const code = (r.itemcode ?? "").trim();
    const key = code.toUpperCase();
    if (!itemToBrand[key]) return; // itemgb '0101' 품목만 집계
    const brand = itemToBrand[key];
    const qty = Number(r.quantity);
    const add = Number.isNaN(qty) ? 0 : qty;
    curSum[brand] = (curSum[brand] ?? 0) + add;
  });
  const prevSum: Record<string, number> = {};
  previous.forEach((r) => {
    const code = (r.itemcode ?? "").trim();
    const key = code.toUpperCase();
    if (!itemToBrand[key]) return; // itemgb '0101' 품목만 집계
    const brand = itemToBrand[key];
    const qty = Number(r.quantity);
    const add = Number.isNaN(qty) ? 0 : qty;
    prevSum[brand] = (prevSum[brand] ?? 0) + add;
  });

  const allBrands = new Set([...Object.keys(curSum), ...Object.keys(prevSum)]);
  const rows: TopBrandRow[] = [];
  allBrands.forEach((brand) => {
    const qtyCurrent = curSum[brand] ?? 0;
    const qtyPrevious = prevSum[brand] ?? 0;
    const { text, isIncrease } = formatChangePercent(qtyCurrent, qtyPrevious);
    rows.push({
      brand,
      qtyCurrent,
      qtyPrevious,
      changePercent: text,
      isIncrease,
    });
  });

  rows.sort((a, b) => b.qtyCurrent - a.qtyCurrent);
  return rows;
}
