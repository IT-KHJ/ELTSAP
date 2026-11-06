import { NextRequest, NextResponse } from "next/server";
import { parseSegment } from "@/lib/constants";
import { getDashboardSummary } from "@/lib/dashboard-queries";
import { serverErrorResponse } from "@/lib/api-error";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/summary?start=2025-01&end=2025-12&segment=ALL|ELT|중고등 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "조회 기간을 선택하세요." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    if (!sy || !sm || !ey || !em) {
      return NextResponse.json({ error: "조회 기간이 올바르지 않아요. 기간을 다시 선택하세요." }, { status: 400 });
    }
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));
    if (startDate > endDate) {
      return NextResponse.json({ error: "시작일이 종료일보다 늦어요. 기간을 다시 선택하세요." }, { status: 400 });
    }

    const summary = await getDashboardSummary(startDate, endDate, parseSegment(searchParams.get("segment")));
    return NextResponse.json(summary);
  } catch (e) {
    return serverErrorResponse(e, "api/dashboard/summary", "대시보드 자료를 불러오지 못했어요.");
  }
}
