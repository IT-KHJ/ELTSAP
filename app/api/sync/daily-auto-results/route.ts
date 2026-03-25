import { NextRequest, NextResponse } from "next/server";
import {
  getDailyAutoSyncResult,
  getRecentDailyBatchHistory,
  getRecentHourlySyncResults,
  getTodayDateString,
} from "@/lib/daily-auto-sync";

/** GET: ?limit=N → daily(매일 일괄) + hourly(매시) 이력. ?date=YYYY-MM-DD → 단일 날짜 daily 행 */
export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    if (limitParam != null && limitParam !== "") {
      const limit = Math.min(Math.max(parseInt(limitParam, 10) || 5, 1), 31);
      const [daily, hourly] = await Promise.all([
        getRecentDailyBatchHistory(limit),
        getRecentHourlySyncResults(limit),
      ]);
      return NextResponse.json({ daily, hourly });
    }
    const dateStr = request.nextUrl.searchParams.get("date") ?? undefined;
    const targetDate = dateStr ?? getTodayDateString();
    const result = await getDailyAutoSyncResult(targetDate);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
