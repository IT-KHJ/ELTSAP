/**
 * 판매(전체) 동기화 스크립트
 * 실행: npm run sync:orders 또는 tsx scripts/run-orders-sync.ts
 * (.env.local에 CRON_SECRET, PORT 필요. Next.js 앱이 localhost에서 실행 중이어야 함)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const PORT = process.env.PORT ?? "3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function main() {
  const url = `http://localhost:${PORT}/api/cron/orders-sync`;
  const res = await fetch(url, {
    method: "GET",
    headers: CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {},
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok) {
    console.error("동기화 실패:", data?.error ?? res.statusText);
    process.exit(1);
  }
  console.log("판매(전체) 동기화 완료:", data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
