import { NextRequest, NextResponse } from "next/server";
import { insertHourlySyncResult } from "@/lib/daily-auto-sync";

function getBaseUrl(): string {
  const url = process.env.VERCEL_URL;
  if (url) return `https://${url}`;
  return process.env.VERCEL
    ? "https://eltsap.vercel.app"
    : `http://localhost:${process.env.PORT ?? 3000}`;
}

/** 입금 → 기타출고 → 매출 → 판매 (증분). 완료 후 hourly_sync_results 기록 */
const HOURLY_SYNC_STEPS = [
  { path: "/api/sync/inamt/run", key: "inamt" as const },
  { path: "/api/sync/saleetc/run", key: "saleetc" as const },
  { path: "/api/sync/sales/run", key: "sales" as const },
  { path: "/api/sync/orders/run", key: "orders" as const },
] as const;

type StepKey = (typeof HOURLY_SYNC_STEPS)[number]["key"];

/** GET: CRON_SECRET 검증 후 증분 동기화 순차 실행 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl();
  const counts: Record<StepKey, number> = {
    inamt: 0,
    saleetc: 0,
    sales: 0,
    orders: 0,
  };
  let status: "success" | "partial" | "failed" = "success";

  for (const { path, key } of HOURLY_SYNC_STEPS) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        inserted?: number;
        updated?: number;
        error?: string;
      };
      const ok = res.ok && data?.success;
      counts[key] = (data?.inserted ?? 0) + (data?.updated ?? 0);
      if (!ok) {
        status = res.ok ? "partial" : "failed";
        break;
      }
    } catch {
      status = "failed";
      break;
    }
  }

  try {
    await insertHourlySyncResult({
      status,
      inamt_count: counts.inamt,
      saleetc_count: counts.saleetc,
      sales_count: counts.sales,
      orders_count: counts.orders,
    });
  } catch (e) {
    console.error("[orders-sync] hourly_sync_results 기록 실패:", e);
  }

  if (status !== "success") {
    return NextResponse.json(
      {
        success: false,
        status,
        counts,
        error: status === "failed" ? "동기화 중 오류" : "일부 단계 실패",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, status, counts });
}
