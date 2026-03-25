import { NextRequest, NextResponse } from "next/server";
import { saveDailyAutoSyncResult } from "@/lib/daily-auto-sync";

/** 순서: 거래처 → 품목 → 입금 → 기타출고 → 매출 → 판매. 일괄은 모든 단계에 ?full=1(전체 동기화). */
const AUTO_SYNC_ORDER = [
  { path: "/api/sync/customer/run", key: "customer" as const },
  { path: "/api/sync/itemlist/run", key: "itemlist" as const },
  { path: "/api/sync/inamt/run", key: "inamt" as const },
  { path: "/api/sync/saleetc/run", key: "saleetc" as const },
  { path: "/api/sync/sales/run", key: "sales" as const },
  { path: "/api/sync/orders/run", key: "orders" as const },
] as const;

function getBaseUrl(): string {
  const url = process.env.VERCEL_URL;
  if (url) return `https://${url}`;
  return process.env.VERCEL
    ? "https://eltsap.vercel.app"
    : `http://localhost:${process.env.PORT ?? 3000}`;
}

/** GET: 스케줄러에서 매일 오전 9시(KST) 등 원하는 시각에 호출. CRON_SECRET 검증 후 순차 동기화 실행 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl();
  const counts = { customer: 0, itemlist: 0, inamt: 0, saleetc: 0, sales: 0, orders: 0 };
  let status: "success" | "partial" | "failed" = "success";

  for (const step of AUTO_SYNC_ORDER) {
    try {
      const path = step.path;
      const qs = "?full=1";
      const res = await fetch(`${baseUrl}${path}${qs}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        inserted?: number;
        updated?: number;
      };
      const ok = res.ok && data?.success;
      counts[step.key] = (data?.inserted ?? 0) + (data?.updated ?? 0);
      if (!ok) {
        status = "partial";
        break;
      }
    } catch {
      status = "failed";
      break;
    }
  }

  try {
    await saveDailyAutoSyncResult(counts, status);
  } catch {
    // 저장 실패해도 200 반환 (동기화는 완료됨)
  }

  return NextResponse.json({ success: true, counts, status });
}
