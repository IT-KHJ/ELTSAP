import { NextRequest, NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/dashboard-queries";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/summary?start=2025-01&end=2025-12 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "start, end (yyyy-mm)가 필요합니다." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    if (!sy || !sm || !ey || !em) {
      return NextResponse.json({ error: "start, end 형식이 올바르지 않습니다. (yyyy-mm)" }, { status: 400 });
    }
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));
    if (startDate > endDate) {
      return NextResponse.json({ error: "시작일이 종료일보다 늦을 수 없습니다." }, { status: 400 });
    }

    const summary = await getDashboardSummary(startDate, endDate);
    return NextResponse.json(summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : "대시보드 요약 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
