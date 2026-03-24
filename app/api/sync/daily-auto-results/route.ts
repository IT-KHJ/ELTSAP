import { NextRequest, NextResponse } from "next/server";
import { getDailyAutoSyncResult, getRecentDailyAutoSyncResults } from "@/lib/daily-auto-sync";

/** GET: ?limit=N 이면 최근 N일 이력 반환. 없으면 ?date=YYYY-MM-DD 로 단일 날짜 (기본 오늘) */
export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    if (limitParam != null && limitParam !== "") {
      const limit = Math.min(Math.max(parseInt(limitParam, 10) || 7, 1), 31);
      const results = await getRecentDailyAutoSyncResults(limit);
      return NextResponse.json({ results });
    }
    const dateStr = request.nextUrl.searchParams.get("date") ?? undefined;
    const targetDate = dateStr ?? new Date().toISOString().slice(0, 10);
    const result = await getDailyAutoSyncResult(targetDate);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
