import { NextRequest, NextResponse } from "next/server";
import { getSalesStatusFromOrders } from "@/lib/orders-queries";
import { parseSegment } from "@/lib/constants";
import { serverErrorResponse } from "@/lib/api-error";

/** GET: 거래처 현황(판매기준) 조회. start, end, cardcode?, salesType?, offset?, limit?, segment? (Supabase orders 기반) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const cardcode = searchParams.get("cardcode")?.trim() || null;
    const sido = searchParams.get("sido")?.trim() || null;
    const sigun = searchParams.get("sigun")?.trim() || null;
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const segment = parseSegment(searchParams.get("segment"));

    if (!start || !end) {
      return NextResponse.json(
        { error: "조회 기간을 선택하세요." },
        { status: 400 }
      );
    }

    const result = await getSalesStatusFromOrders({
      startDate: start,
      endDate: end,
      cardcode,
      sido,
      sigun,
      salesType,
      offset,
      limit,
      segment,
    });

    return NextResponse.json(result);
  } catch (e) {
    return serverErrorResponse(e, "api/sales-status", "판매 자료를 불러오지 못했어요.");
  }
}
