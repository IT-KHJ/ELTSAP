import { NextResponse } from "next/server";
import { getSyncTableCounts } from "@/lib/sync-metadata";

/** GET: 각 엔티티 테이블의 실제 행 수 */
export async function GET() {
  try {
    const counts = await getSyncTableCounts();
    return NextResponse.json(counts);
  } catch (e) {
    const message = e instanceof Error ? e.message : "테이블 건수 조회 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
