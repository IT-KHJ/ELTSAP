import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  getSalesByCategory,
  getSubjectBreakdown,
  getInamtMonthly,
  getGiftQtyMonthly,
  getTopItems,
  getTopBrands,
} from "@/lib/report-queries";
import { formatChangePercent } from "@/lib/format";
import type { ReportData } from "@/types/report";
import type { Segment } from "@/lib/constants";
import { serverErrorResponse } from "@/lib/api-error";

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
      return NextResponse.json({ error: "거래처를 선택하세요." }, { status: 400 });
    }
    if (!startParam || !endParam) {
      return NextResponse.json({ error: "조회 기간을 선택하세요." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0)); // 말일
    const prevStartDate = toLocalDateString(new Date(sy - 1, sm - 1, 1));
    const prevEndDate = toLocalDateString(new Date(ey - 1, em, 0));

    const admin = getSupabaseAdmin();
    const { data: cust } = await admin
      .from("rpt_customer")
      .select("cardname, segment")
      .eq("cardcode", cardcode)
      .maybeSingle();

    const cardname = (cust as { cardname?: string } | null)?.cardname ?? cardcode;
    const segment = ((cust as { segment?: string | null } | null)?.segment ?? null) as Segment | null;

    const [salesResult, subjects, inamt, giftQty, topItems, topBrands] = await Promise.all([
      getSalesByCategory(cardcode, startDate, endDate, prevStartDate, prevEndDate, segment),
      segment === "중고등"
        ? getSubjectBreakdown(cardcode, startDate, endDate, prevStartDate, prevEndDate)
        : Promise.resolve({ subjectSales: [], subjectReturns: [] }),
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
      segment,
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
      subjectSales: subjects.subjectSales,
      subjectReturns: subjects.subjectReturns,
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
    return serverErrorResponse(e, "api/report", "보고서를 불러오지 못했어요.");
  }
}
