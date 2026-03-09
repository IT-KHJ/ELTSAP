import { NextRequest, NextResponse } from "next/server";
import { getCustomerDetail } from "@/lib/dashboard-queries";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/customer/[cardcode]?start=...&end=... */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardcode: string }> }
) {
  try {
    const { cardcode } = await params;
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!cardcode?.trim()) {
      return NextResponse.json({ error: "cardcode가 필요합니다." }, { status: 400 });
    }
    if (!startParam || !endParam) {
      return NextResponse.json({ error: "start, end (yyyy-mm)가 필요합니다." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));

    const { monthly, itemSales, itemReturns, cardname } = await getCustomerDetail(
      cardcode,
      startDate,
      endDate
    );

    return NextResponse.json({
      cardcode,
      cardname,
      monthly,
      itemSales,
      itemReturns,
      startDate,
      endDate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 상세 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
