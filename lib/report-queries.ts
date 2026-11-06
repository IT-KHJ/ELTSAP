/**
 * 거래처 현황 보고서용 집계.
 * 월 단위 집계는 서버 SQL로 처리, 클라이언트 reduce 금지.
 * 데이터: SAP 원본 미러 기반 rpt_sales_line / rpt_payment(거래원장과 같은 입금 규칙) / rpt_gift_line / sap_oitm (030~032 마이그레이션)
 */

import { getSupabaseAdmin } from "./supabase";
import {
  CATEGORY_BG,
  CATEGORY_OUP,
  LABEL_BG,
  LABEL_OUP,
  LABEL_BG_RETURN,
  LABEL_OUP_RETURN,
  LABEL_JHG,
  LABEL_JHG_RETURN,
  MONTHS,
  SUBJECT_ORDER,
  SUBJECT_BY_OCRCODE2,
  SPLIT_TRIGGER_SUBJECTS,
  type Segment,
} from "./constants";
import type { MonthlyAmount, SalesByCategory, TopItemRow, TopBrandRow } from "@/types/report";
import { formatChangePercent } from "./format";
import { UserMessageError } from "./user-error";

function emptyMonthly(): MonthlyAmount {
  const o: MonthlyAmount = { total: 0 } as MonthlyAmount;
  MONTHS.forEach((m) => ((o as unknown as Record<string, number>)[String(m)] = 0));
  return o;
}

const SALES_PAGE_SIZE = 1000;

/** DB 함수 get_sales_by_category_monthly 호출 - 사용자 SQL과 동일한 EXISTS 조인 로직 */
type MonthlyRow = { month: number; total: number };
async function fetchSalesByCategoryFromDb(
  admin: ReturnType<typeof getSupabaseAdmin>,
  cardcode: string,
  startDate: string,
  endDate: string,
  itmsgrpcod: number,
  returnsOnly: boolean
): Promise<MonthlyAmount> {
  const { data } = await admin.rpc("rpt_sales_by_category_monthly", {
    p_basecard: cardcode,
    p_start: startDate,
    p_end: endDate,
    p_itmsgrpcod: itmsgrpcod,
    p_returns_only: returnsOnly,
  });
  const rows = (data ?? []) as MonthlyRow[];
  const m = emptyMonthly();
  let total = 0;
  rows.forEach((r) => {
    const amt = Number(r.total) || 0;
    total += amt;
    const k = String(r.month);
    if (r.month >= 1 && r.month <= 12) {
      (m as unknown as Record<string, number>)[k] = ((m as unknown as Record<string, number>)[k] || 0) + amt;
    }
  });
  m.total = total;
  return m;
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
      .from("rpt_sales_line")
      .select("itemcode, quantity")
      .eq("basecard", cardcode)
      .gte("docdate", startDate)
      .lte("docdate", endDate)
      .order("source")
      .order("docentry")
      .order("linenum")
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

/** SALES + ITEMLIST EXISTS 조인으로 월별 totalsumsy 집계 (사용자 SQL과 동일 로직)
 * 매출: 양수/음수/0 모두 합산. 반품: totalsumsy < 0만 */
function applyChangePercent(cat: SalesByCategory) {
  const c = cat.currentYear;
  const p = cat.previousYear;
  MONTHS.forEach((month) => {
    const key = String(month);
    const cv = (c as unknown as Record<string, number>)[key] ?? 0;
    const pv = (p as unknown as Record<string, number>)[key] ?? 0;
    (cat.changePercent as Record<string, string>)[key] = formatChangePercent(cv, pv).text;
  });
  (cat.changePercent as Record<string, string>).total = formatChangePercent(c.total, p.total).text;
}

export async function getSalesByCategory(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string,
  segment: Segment | null
): Promise<{ salesByCategory: SalesByCategory[]; returnsByCategory: SalesByCategory[] }> {
  const admin = getSupabaseAdmin();
  const ITMSGRP_BG = 100;
  const ITMSGRP_OUP = 101;

  const [bgCur, bgPrev, oupCur, oupPrev, retBgCur, retBgPrev, retOupCur, retOupPrev] = await Promise.all([
    fetchSalesByCategoryFromDb(admin, cardcode, startDate, endDate, ITMSGRP_BG, false),
    fetchSalesByCategoryFromDb(admin, cardcode, previousStart, previousEnd, ITMSGRP_BG, false),
    fetchSalesByCategoryFromDb(admin, cardcode, startDate, endDate, ITMSGRP_OUP, false),
    fetchSalesByCategoryFromDb(admin, cardcode, previousStart, previousEnd, ITMSGRP_OUP, false),
    fetchSalesByCategoryFromDb(admin, cardcode, startDate, endDate, ITMSGRP_BG, true),
    fetchSalesByCategoryFromDb(admin, cardcode, previousStart, previousEnd, ITMSGRP_BG, true),
    fetchSalesByCategoryFromDb(admin, cardcode, startDate, endDate, ITMSGRP_OUP, true),
    fetchSalesByCategoryFromDb(admin, cardcode, previousStart, previousEnd, ITMSGRP_OUP, true),
  ]);

  const salesResult: SalesByCategory[] = [
    { categoryCode: CATEGORY_BG, categoryLabel: segment === "중고등" ? LABEL_JHG : LABEL_BG, currentYear: bgCur, previousYear: bgPrev, changePercent: {} },
    { categoryCode: CATEGORY_OUP, categoryLabel: LABEL_OUP, currentYear: oupCur, previousYear: oupPrev, changePercent: {} },
  ];
  const returnsResult: SalesByCategory[] = [
    { categoryCode: CATEGORY_BG, categoryLabel: segment === "중고등" ? LABEL_JHG_RETURN : LABEL_BG_RETURN, currentYear: retBgCur, previousYear: retBgPrev, changePercent: {} },
    { categoryCode: CATEGORY_OUP, categoryLabel: LABEL_OUP_RETURN, currentYear: retOupCur, previousYear: retOupPrev, changePercent: {} },
  ];
  salesResult.forEach(applyChangePercent);
  returnsResult.forEach(applyChangePercent);

  return { salesByCategory: salesResult, returnsByCategory: returnsResult };
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
  // 거래원장과 동일한 입금 규칙(rpt_payment): 입금 문서 + 수동 분개 입금, 채권조정 제외
  const { data: currentRaw } = await admin
    .from("rpt_payment")
    .select("docdate:txdate, doctotal:amount")
    .eq("cardcode", cardcode)
    .eq("gubun", "입금")
    .gte("txdate", startDate)
    .lte("txdate", endDate);

  const { data: previousRaw } = await admin
    .from("rpt_payment")
    .select("docdate:txdate, doctotal:amount")
    .eq("cardcode", cardcode)
    .eq("gubun", "입금")
    .gte("txdate", previousStart)
    .lte("txdate", previousEnd);

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
  type SaleetcQtyRow = { docdate: string | null; quantity: number | null };
  // 1,000행 제한(PostgREST) 때문에 페이지 단위로 전부 조회 (기존에는 첫 1,000행만 집계되던 문제)
  const fetchAll = async (from: string, to: string): Promise<SaleetcQtyRow[]> => {
    const out: SaleetcQtyRow[] = [];
    let offset = 0;
    while (true) {
      const { data } = await admin
        .from("rpt_gift_line")
        .select("docdate, quantity")
        .eq("basecard", cardcode)
        .gte("docdate", from)
        .lte("docdate", to)
        .order("docentry")
        .order("linenum")
        .range(offset, offset + SALES_PAGE_SIZE - 1);
      const rows = (data ?? []) as SaleetcQtyRow[];
      out.push(...rows);
      if (rows.length < SALES_PAGE_SIZE) break;
      offset += SALES_PAGE_SIZE;
    }
    return out;
  };

  const [current, previous] = await Promise.all([fetchAll(startDate, endDate), fetchAll(previousStart, previousEnd)]);

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
    .from("sap_oitm")
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
  const itemToBrand: Record<string, string> = {};
  for (let i = 0; i < codesArr.length; i += ITEMLIST_BATCH_SIZE) {
    const chunk = codesArr.slice(i, i + ITEMLIST_BATCH_SIZE);
    const { data: itemsRaw } = await admin
      .from("sap_oitm")
      .select("itemcode, brand:u_level3nm")
      .in("itemcode", chunk);
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
    if (!key) return;
    const brand = itemToBrand[key] ?? "미지정";
    const qty = Number(r.quantity);
    const add = Number.isNaN(qty) ? 0 : qty;
    curSum[brand] = (curSum[brand] ?? 0) + add;
  });
  const prevSum: Record<string, number> = {};
  previous.forEach((r) => {
    const code = (r.itemcode ?? "").trim();
    const key = code.toUpperCase();
    if (!key) return;
    const brand = itemToBrand[key] ?? "미지정";
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

/**
 * 중고등 과목별 하위 행 (마감기준 "중고등 매출/반품" 아래 영어/수학/국어).
 * 제품(itmsgrpcod 100)만, 과목 = SAP 판매 부서(OcrCode2). 하위 행 합 = 중고등 매출/반품 행.
 * 표시 판단(2026-11-06 사용자 결정): 거래처별로 올해·전년 × 매출·반품 중 수학 또는 국어 금액이 하나라도 있으면
 * 매출·반품 모두 과목별로 나눠 표시, 없으면 빈 배열(하나로 표시).
 */
export async function getSubjectBreakdown(
  cardcode: string,
  startDate: string,
  endDate: string,
  previousStart: string,
  previousEnd: string
): Promise<{ subjectSales: SalesByCategory[]; subjectReturns: SalesByCategory[] }> {
  const admin = getSupabaseAdmin();
  type DeptRow = { ocrcode2: string | null; month: number; total: number; returns: number };
  const fetchPeriod = async (s: string, e: string) => {
    const { data, error } = await admin.rpc("rpt_sales_by_dept_monthly", {
      p_basecard: cardcode,
      p_start: s,
      p_end: e,
      p_itmsgrpcod: Number(CATEGORY_BG),
    });
    if (error) throw new Error(error.message);
    const sales: Record<string, MonthlyAmount> = {};
    const returns: Record<string, MonthlyAmount> = {};
    SUBJECT_ORDER.forEach((subj) => {
      sales[subj] = emptyMonthly();
      returns[subj] = emptyMonthly();
    });
    ((data ?? []) as DeptRow[]).forEach((r) => {
      const subj = SUBJECT_BY_OCRCODE2[r.ocrcode2 ?? ""];
      if (!subj) {
        console.error(`[report] 과목 매핑이 없는 부서 코드: ${r.ocrcode2} (lib/constants.ts SUBJECT_BY_OCRCODE2)`);
        throw new UserMessageError("이 거래처의 일부 판매 자료가 아직 과목별로 분류되지 않아 보고서를 보여 드릴 수 없어요.\n관리자에게 문의하세요.");
      }
      const k = String(r.month);
      const t = Number(r.total) || 0;
      const rt = Number(r.returns) || 0;
      const sm = sales[subj] as unknown as Record<string, number>;
      const rm = returns[subj] as unknown as Record<string, number>;
      if (r.month >= 1 && r.month <= 12) {
        sm[k] += t;
        rm[k] += rt;
      }
      sm.total += t;
      rm.total += rt;
    });
    return { sales, returns };
  };

  const [cur, prev] = await Promise.all([
    fetchPeriod(startDate, endDate),
    fetchPeriod(previousStart, previousEnd),
  ]);

  const hasData = (m: MonthlyAmount) =>
    MONTHS.some((mo) => ((m as unknown as Record<string, number>)[String(mo)] ?? 0) !== 0) || m.total !== 0;
  const split = SPLIT_TRIGGER_SUBJECTS.some(
    (subj) =>
      hasData(cur.sales[subj]) || hasData(prev.sales[subj]) || hasData(cur.returns[subj]) || hasData(prev.returns[subj])
  );
  if (!split) return { subjectSales: [], subjectReturns: [] };

  const build = (kind: "sales" | "returns") =>
    SUBJECT_ORDER.map((subj) => {
      const cat: SalesByCategory = {
        categoryCode: CATEGORY_BG,
        categoryLabel: `└ ${subj}`,
        currentYear: cur[kind][subj],
        previousYear: prev[kind][subj],
        changePercent: {},
      };
      applyChangePercent(cat);
      return cat;
    });
  return { subjectSales: build("sales"), subjectReturns: build("returns") };
}
