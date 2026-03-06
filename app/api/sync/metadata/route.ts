import { NextResponse } from "next/server";
import { getAllSyncMetadata } from "@/lib/sync-metadata";

/** GET: 엔티티별 마지막 동기화 일자 및 건수. projectRef로 대시보드와 동일 프로젝트인지 확인 가능 */
export async function GET() {
  try {
    const rows = await getAllSyncMetadata();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
    return NextResponse.json({ projectRef, rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "메타데이터 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
