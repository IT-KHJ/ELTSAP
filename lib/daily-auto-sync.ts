/**
 * 매일 자동 동기화 결과 저장/조회
 */

import { getSupabaseAdmin } from "./supabase";

export interface DailyAutoSyncResult {
  sync_date: string;
  customer_count: number;
  itemlist_count: number;
  inamt_count: number;
  saleetc_count: number;
  sales_count: number;
  completed_at: string;
  status: "success" | "partial" | "failed";
}

export interface DailyAutoSyncCounts {
  customer: number;
  itemlist: number;
  inamt: number;
  saleetc: number;
  sales: number;
}

/** 오늘 날짜(YYYY-MM-DD) 반환 (로컬 기준) */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/** 자동 동기화 결과 저장 */
export async function saveDailyAutoSyncResult(
  counts: DailyAutoSyncCounts,
  status: "success" | "partial" | "failed"
): Promise<void> {
  const syncDate = getTodayDateString();
  const admin = getSupabaseAdmin();
  await admin.from("daily_auto_sync_results").upsert(
    {
      sync_date: syncDate,
      customer_count: counts.customer,
      itemlist_count: counts.itemlist,
      inamt_count: counts.inamt,
      saleetc_count: counts.saleetc,
      sales_count: counts.sales,
      completed_at: new Date().toISOString(),
      status,
    },
    { onConflict: "sync_date" }
  );
}

/** 특정 날짜의 자동 동기화 결과 조회. 없으면 null */
export async function getDailyAutoSyncResult(
  dateStr: string
): Promise<DailyAutoSyncResult | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("daily_auto_sync_results")
    .select("*")
    .eq("sync_date", dateStr)
    .maybeSingle();
  if (error || !data) return null;
  return data as DailyAutoSyncResult;
}
