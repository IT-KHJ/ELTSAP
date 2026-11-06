import { NextRequest, NextResponse } from "next/server";
import { parseSegment } from "@/lib/constants";
import { getCustomerRanking } from "@/lib/dashboard-queries";
import { serverErrorResponse } from "@/lib/api-error";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** GET /api/dashboard/ranking?start=...&end=...&segment=...&cardcode=...&sortBy=...&order=...&page=...&limit=... */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const cardcode = searchParams.get("cardcode")?.trim() || undefined;
    const sido = searchParams.get("sido")?.trim() || undefined;
    const sigun = searchParams.get("sigun")?.trim() || undefined;
    const sortBy = (searchParams.get("sortBy") as "sales" | "netSales" | "returns" | "returnRate" | "orderCount" | "sharePercent" | "cardname" | "aliasname") || "sales";
    const order = (searchParams.get("order") as "asc" | "desc") || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "조회 기간을 선택하세요." }, { status: 400 });
    }

    const [sy, sm] = startParam.split("-").map(Number);
    const [ey, em] = endParam.split("-").map(Number);
    const startDate = toLocalDateString(new Date(sy, sm - 1, 1));
    const endDate = toLocalDateString(new Date(ey, em, 0));

    const result = await getCustomerRanking(startDate, endDate, {
      segment: parseSegment(searchParams.get("segment")),
      cardcode,
      sido,
      sigun,
      sortBy,
      order,
      page,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    return serverErrorResponse(e, "api/dashboard/ranking", "대시보드 자료를 불러오지 못했어요.");
  }
}
