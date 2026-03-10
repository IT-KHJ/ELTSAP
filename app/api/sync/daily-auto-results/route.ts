import { NextRequest, NextResponse } from "next/server";
import { getDailyAutoSyncResult } from "@/lib/daily-auto-sync";

/** GET: 오늘 날짜의 자동 동기화 결과 조회. ?date=YYYY-MM-DD 로 특정 날짜 지정 가능 */
export async function GET(request: NextRequest) {
  try {
    const dateStr = request.nextUrl.searchParams.get("date") ?? undefined;
    const targetDate = dateStr ?? new Date().toISOString().slice(0, 10);
    const result = await getDailyAutoSyncResult(targetDate);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
