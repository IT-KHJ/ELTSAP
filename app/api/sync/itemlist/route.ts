import { NextRequest, NextResponse } from "next/server";
import { upsertItemlistBatch } from "@/lib/sync-ops";
import type { SyncItemlistPayload } from "@/types/sync";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncItemlistPayload;
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "data 배열이 필요합니다." },
        { status: 400 }
      );
    }
    const result = await upsertItemlistBatch(data);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
