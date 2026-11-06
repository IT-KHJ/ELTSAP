import { NextRequest, NextResponse } from "next/server";
import { getSalesStatusGroupedFromOrders } from "@/lib/orders-queries";
import { parseSegment } from "@/lib/constants";
import { serverErrorResponse } from "@/lib/api-error";

/** GET: B안 거래처 현황(판매집계) 그룹화 조회. start, end, salesType?, segment? (Supabase orders 기반) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";
    const sido = searchParams.get("sido")?.trim() || null;
    const sigun = searchParams.get("sigun")?.trim() || null;
    const segment = parseSegment(searchParams.get("segment"));

    if (!start || !end) {
      return NextResponse.json(
        { error: "조회 기간을 선택하세요." },
        { status: 400 }
      );
    }

    const result = await getSalesStatusGroupedFromOrders(start, end, salesType, sido, sigun, segment);
    return NextResponse.json(result);
  } catch (e) {
    return serverErrorResponse(e, "api/sales-status-grouped", "판매 자료를 불러오지 못했어요.");
  }
}
