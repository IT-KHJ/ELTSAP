import { NextRequest, NextResponse } from "next/server";
import { getSalesStatusGrouped } from "@/lib/sales-status-grouped-queries";

/** GET: B안 거래처 현황(판매기준) 그룹화 조회. start, end, salesType? */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";

    if (!start || !end) {
      return NextResponse.json(
        { error: "start와 end 파라미터가 필요합니다. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const result = await getSalesStatusGrouped(start, end, salesType);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
