import { NextRequest, NextResponse } from "next/server";
import { getSalesStatus } from "@/lib/sales-status-queries";

/** GET: 거래처 현황(판매기준) 조회. start, end, cardcode?, salesType?, offset?, limit? */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start")?.trim();
    const end = searchParams.get("end")?.trim();
    const cardcode = searchParams.get("cardcode")?.trim() || null;
    const salesType = (searchParams.get("salesType") as "all" | "sales" | "return") || "all";
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));

    if (!start || !end) {
      return NextResponse.json(
        { error: "start와 end 파라미터가 필요합니다. (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const result = await getSalesStatus({
      startDate: start,
      endDate: end,
      cardcode,
      salesType,
      offset,
      limit,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
