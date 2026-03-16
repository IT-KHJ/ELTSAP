import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getSalesByCategory,
  getInamtMonthly,
  getGiftQtyMonthly,
  getTopItems,
  getTopBrands,
} from "@/lib/report-queries";
import { formatChangePercent } from "@/lib/format";
import type { ReportData } from "@/types/report";

/** 로컬 날짜 기준 YYYY-MM-DD (toISOString은 UTC라 KST에서 연도/일이 어긋남) */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/report?cardcode=...&start=2025-01&end=2025-12 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardcode = searchParams.get("cardcode");
    const startParam = searchParams.get("start"); // yyyy-mm
    const endParam = searchParams.get("end"); // yyyy-mm

    if (!cardcode?.trim()) {
      return NextResponse.json({ error: "cardcode가 필요합니다." }, { status: 400 });
    }
    if (!startParam || !endParam) {
      return NextResponse.json({ error: "start, end (yyyy-mm)가 필요합니다." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0)); // 말일
    const prevStartDate = toLocalDateString(new Date(sy - 1, sm - 1, 1));
    const prevEndDate = toLocalDateString(new Date(ey - 1, em, 0));

    const admin = getSupabaseAdmin();
    const { data: cust } = await admin
      .from("customer")
      .select("cardname")
      .eq("cardcode", cardcode)
      .maybeSingle();

    const cardname = (cust as { cardname?: string } | null)?.cardname ?? cardcode;

    const [salesResult, inamt, giftQty, topItems, topBrands] = await Promise.all([
      getSalesByCategory(cardcode, startDate, endDate, prevStartDate, prevEndDate),
      getInamtMonthly(cardcode, startDate, endDate, prevStartDate, prevEndDate),
      getGiftQtyMonthly(cardcode, startDate, endDate, prevStartDate, prevEndDate),
      getTopItems(cardcode, startDate, endDate, prevStartDate, prevEndDate, 20),
      getTopBrands(cardcode, startDate, endDate, prevStartDate, prevEndDate, 20),
    ]);

    const { salesByCategory, returnsByCategory } = salesResult;

    const totalCurrent =
      salesByCategory.reduce((s, c) => s + c.currentYear.total, 0) || 0;
    const totalPrevious =
      salesByCategory.reduce((s, c) => s + c.previousYear.total, 0) || 0;
    const { text: summaryChange } = formatChangePercent(totalCurrent, totalPrevious);
    const diffAmount = totalCurrent - totalPrevious;

    const returnTotalCurrent =
      returnsByCategory.reduce((s, c) => s + c.currentYear.total, 0) || 0;
    const returnTotalPrevious =
      returnsByCategory.reduce((s, c) => s + c.previousYear.total, 0) || 0;
    const { text: returnChangePercent } = formatChangePercent(returnTotalCurrent, returnTotalPrevious);
    const returnDiffAmount = returnTotalCurrent - returnTotalPrevious;

    const report: ReportData = {
      cardcode,
      cardname,
      startDate,
      endDate,
      previousStartDate: prevStartDate,
      previousEndDate: prevEndDate,
      summary: {
        totalCurrent,
        totalPrevious,
        changePercent: summaryChange,
        diffAmount,
        returnTotalCurrent,
        returnTotalPrevious,
        returnChangePercent,
        returnDiffAmount,
      },
      salesByCategory,
      returnsByCategory,
      inamt,
      giftQty,
      topItems: topItems.map((r) => ({
        ...r,
        changePercent: r.changePercent,
        isIncrease: r.isIncrease,
      })),
      topBrands,
    };

    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "보고서 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
