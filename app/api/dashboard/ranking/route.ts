import { NextRequest, NextResponse } from "next/server";
import { getCustomerRanking } from "@/lib/dashboard-queries";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/ranking?start=...&end=...&cardcode=...&sortBy=...&order=...&page=...&limit=... */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const cardcode = searchParams.get("cardcode")?.trim() || undefined;
    const sortBy = (searchParams.get("sortBy") as "sales" | "netSales" | "returns" | "returnRate" | "orderCount" | "sharePercent" | "cardname" | "aliasname") || "sales";
    const order = (searchParams.get("order") as "asc" | "desc") || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "start, end (yyyy-mm)가 필요합니다." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));

    const result = await getCustomerRanking(startDate, endDate, {
      cardcode,
      sortBy,
      order,
      page,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "거래처 랭킹 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
