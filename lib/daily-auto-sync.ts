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
  /** 마지막 판매(orders) 동기화 반영 건수(inserted+updated) */
  orders_count: number;
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

/** 자동 동기화 결과 저장 (일괄). 기존 orders_count는 유지 */
export async function saveDailyAutoSyncResult(
  counts: DailyAutoSyncCounts,
  status: "success" | "partial" | "failed"
): Promise<void> {
  const syncDate = getTodayDateString();
  const admin = getSupabaseAdmin();
  const existing = await getDailyAutoSyncResult(syncDate);
  const ordersCount = existing?.orders_count ?? 0;
  await admin.from("daily_auto_sync_results").upsert(
    {
      sync_date: syncDate,
      customer_count: counts.customer,
      itemlist_count: counts.itemlist,
      inamt_count: counts.inamt,
      saleetc_count: counts.saleetc,
      sales_count: counts.sales,
      orders_count: ordersCount,
      completed_at: new Date().toISOString(),
      status,
    },
    { onConflict: "sync_date" }
  );
}

/** 판매(orders) 동기화 성공 시 당일 행에 반영 건수만 병합. completed_at은 일괄 동기화용이므로 변경하지 않음 */
export async function mergeOrdersDailySyncResult(
  inserted: number,
  updated: number
): Promise<void> {
  const syncDate = getTodayDateString();
  const admin = getSupabaseAdmin();
  const count = inserted + updated;
  const existing = await getDailyAutoSyncResult(syncDate);
  if (existing) {
    const { error } = await admin
      .from("daily_auto_sync_results")
      .update({ orders_count: count })
      .eq("sync_date", syncDate);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await admin.from("daily_auto_sync_results").insert({
    sync_date: syncDate,
    customer_count: 0,
    itemlist_count: 0,
    inamt_count: 0,
    saleetc_count: 0,
    sales_count: 0,
    orders_count: count,
    completed_at: new Date().toISOString(),
    status: "success",
  });
  if (error) throw new Error(error.message);
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

/** 최근 N일간의 자동 동기화 결과 조회. sync_date 내림차순 */
export async function getRecentDailyAutoSyncResults(
  limit: number
): Promise<DailyAutoSyncResult[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("daily_auto_sync_results")
    .select("*")
    .order("sync_date", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as DailyAutoSyncResult[];
}
