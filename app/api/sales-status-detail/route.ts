import { NextRequest, NextResponse } from "next/server";
import { getSalesStatusDetailFromOrders } from "@/lib/orders-queries";
import { serverErrorResponse } from "@/lib/api-error";

/** GET: B안 거래처 현황 상세 조회. start, end, cardcode, salesType? (Supabase orders 기반) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const cardcode = searchParams.get("cardcode")?.trim();
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";

    if (!start || !end || !cardcode) {
      return NextResponse.json(
        { error: "거래처와 조회 기간을 선택하세요." },
        { status: 400 }
      );
    }

    const rows = await getSalesStatusDetailFromOrders(start, end, cardcode, salesType);
    return NextResponse.json({ rows });
  } catch (e) {
    return serverErrorResponse(e, "api/sales-status-detail", "판매 상세 자료를 불러오지 못했어요.");
  }
}
