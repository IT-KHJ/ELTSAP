import { NextRequest, NextResponse } from "next/server";
import { getParetoData } from "@/lib/dashboard-queries";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/pareto?start=...&end=... */
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
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));

    const rows = await getParetoData(startDate, endDate);
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pareto 집중도 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
