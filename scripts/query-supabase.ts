/**
 * Supabase 직접 쿼리 스크립트
 * 실행: npx tsx scripts/query-supabase.ts
 * (.env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (또는 ANON_KEY) 필요");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // 2025-01-01 ~ 2025-12-31 SALES 조회 (docdate 범위)
  const startDate = "2025-01-01";
  const endExclusive = "2026-01-01";

  console.log("=== SALES 조회 (2025-01-01 ~ 2025-12-31) ===\n");

  const { data, error } = await supabase
    .from("SALES")
    .select("basecard, docdate, totalsumsy")
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", startDate)
    .lt("docdate", endExclusive)
    .limit(20);

  if (error) {
    console.error("에러:", error);
    return;
  }

  console.log(`총 ${(data ?? []).length}건 (최대 20건)\n`);
  console.table(data ?? []);

  // 전체 건수
  const { count } = await supabase
    .from("SALES")
    .select("id", { count: "exact", head: true })
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", startDate)
    .lt("docdate", endExclusive);

  console.log(`\n전체 건수: ${count ?? "?"}`);

  // docdate min/max
  const { data: range } = await supabase
    .from("SALES")
    .select("docdate")
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", startDate)
    .lt("docdate", endExclusive)
    .order("docdate", { ascending: true })
    .limit(1);

  const { data: rangeMax } = await supabase
    .from("SALES")
    .select("docdate")
    .or("linestatus.eq.O,linestatus.is.null")
    .gte("docdate", startDate)
    .lt("docdate", endExclusive)
    .order("docdate", { ascending: false })
    .limit(1);

  console.log("docdate 최소:", (range ?? [])[0]?.docdate ?? "-");
  console.log("docdate 최대:", (rangeMax ?? [])[0]?.docdate ?? "-");
}

main().catch(console.error);
