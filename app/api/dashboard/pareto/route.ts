import { NextRequest, NextResponse } from "next/server";
import { parseSegment } from "@/lib/constants";
import { getParetoData } from "@/lib/dashboard-queries";
import { serverErrorResponse } from "@/lib/api-error";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/pareto?start=...&end=...&segment=... */
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
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));

    const rows = await getParetoData(startDate, endDate, parseSegment(searchParams.get("segment")));
    return NextResponse.json({ rows });
  } catch (e) {
    return serverErrorResponse(e, "api/dashboard/pareto", "대시보드 자료를 불러오지 못했어요.");
  }
}
