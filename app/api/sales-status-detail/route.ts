import { NextRequest, NextResponse } from "next/server";
import { getSalesStatusDetail } from "@/lib/sales-status-grouped-queries";

/** GET: B안 거래처 현황 상세 조회. start, end, cardcode, salesType? */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const cardcode = searchParams.get("cardcode")?.trim();
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";

    if (!start || !end || !cardcode) {
      return NextResponse.json(
        { error: "start, end, cardcode 파라미터가 필요합니다. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const rows = await getSalesStatusDetail(start, end, cardcode, salesType);
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
