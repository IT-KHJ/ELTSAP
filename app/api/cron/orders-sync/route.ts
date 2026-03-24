import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(): string {
  const url = process.env.VERCEL_URL;
  if (url) return `https://${url}`;
  return process.env.VERCEL
    ? "https://eltsap.vercel.app"
    : `http://localhost:${process.env.PORT ?? 3000}`;
}

/** GET: CRON_SECRET 검증 후 /api/sync/orders/run 호출 (판매 전체 동기화) */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/sync/orders/run`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: (data as { error?: string })?.error ?? "동기화 실패" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
