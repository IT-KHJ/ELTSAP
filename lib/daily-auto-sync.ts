/**
 * 매일 자동 동기화 결과 저장/조회 + 매시간 cron 이력
 */

import { getSupabaseAdmin } from "./supabase";

export interface DailyAutoSyncResult {
  sync_date: string;
  customer_count: number;
  itemlist_count: number;
  inamt_count: number;
  saleetc_count: number;
  sales_count: number;
  orders_count: number;
  completed_at: string | null;
  orders_completed_at: string | null;
  status: "success" | "partial" | "failed";
}

export interface HourlySyncResult {
  id: string;
  completed_at: string;
  status: "success" | "partial" | "failed";
  inamt_count: number;
  saleetc_count: number;
  sales_count: number;
  orders_count: number;
}

export interface DailyAutoSyncCounts {
  customer: number;
  itemlist: number;
  inamt: number;
  saleetc: number;
  sales: number;
  /** 일괄 마지막 단계 판매(orders) 동기화 반영 건수(inserted+updated) */
  orders: number;
}

/** 오늘 날짜(YYYY-MM-DD) 로컬(브라우저/서버 로컬 타임존) 기준 */
export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 로컬 자정 기준 N일 전 시각 (보존 삭제 cutoff) */
function getLocalMidnightDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 레거시: 일괄 없이 판매만 넣은 행(구 mergeOrders) — 좌측 패널에서 제외 */
export function isOrdersOnlyDailyRow(r: DailyAutoSyncResult): boolean {
  const sumBatch =
    r.customer_count +
    r.itemlist_count +
    r.inamt_count +
    r.saleetc_count +
    r.sales_count;
  return (
    sumBatch === 0 &&
    (r.orders_count ?? 0) > 0 &&
    r.status === "success" &&
    r.completed_at != null
  );
}

/** 자동 동기화 결과 저장 (일괄 auto-sync 전용). orders_count는 일괄의 판매(전체) 단계 반영 건수 */
export async function saveDailyAutoSyncResult(
  counts: DailyAutoSyncCounts,
  status: "success" | "partial" | "failed"
): Promise<void> {
  const syncDate = getTodayDateString();
  const admin = getSupabaseAdmin();
  const existing = await getDailyAutoSyncResult(syncDate);
  const ordersCompletedAt = existing?.orders_completed_at ?? null;
  await admin.from("daily_auto_sync_results").upsert(
    {
      sync_date: syncDate,
      customer_count: counts.customer,
      itemlist_count: counts.itemlist,
      inamt_count: counts.inamt,
      saleetc_count: counts.saleetc,
      sales_count: counts.sales,
      orders_count: counts.orders,
      orders_completed_at: ordersCompletedAt,
      completed_at: new Date().toISOString(),
      status,
    },
    { onConflict: "sync_date" }
  );
  await pruneDailyAutoSyncResults();
}

/** `sync_date`가 로컬 기준 N일 이전인 행 삭제 */
export async function pruneDailyAutoSyncResults(retentionDays = 5): Promise<void> {
  const cutoff = getLocalMidnightDaysAgo(retentionDays);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const admin = getSupabaseAdmin();
  await admin.from("daily_auto_sync_results").delete().lt("sync_date", cutoffStr);
}

/** 매시 이력: completed_at 기준 retentionDays 이전 삭제 */
export async function pruneHourlySyncResults(retentionDays = 5): Promise<void> {
  const cutoff = getLocalMidnightDaysAgo(retentionDays);
  const admin = getSupabaseAdmin();
  await admin.from("hourly_sync_results").delete().lt("completed_at", cutoff.toISOString());
}

export async function insertHourlySyncResult(row: {
  status: "success" | "partial" | "failed";
  inamt_count: number;
  saleetc_count: number;
  sales_count: number;
  orders_count: number;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("hourly_sync_results").insert({
    completed_at: new Date().toISOString(),
    status: row.status,
    inamt_count: row.inamt_count,
    saleetc_count: row.saleetc_count,
    sales_count: row.sales_count,
    orders_count: row.orders_count,
  });
  if (error) throw new Error(error.message);
  await pruneHourlySyncResults();
}

export async function getDailyAutoSyncResult(dateStr: string): Promise<DailyAutoSyncResult | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("daily_auto_sync_results")
    .select("*")
    .eq("sync_date", dateStr)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeDailyRow(data as Record<string, unknown>);
}

function normalizeDailyRow(data: Record<string, unknown>): DailyAutoSyncResult {
  return {
    sync_date: String(data.sync_date ?? ""),
    customer_count: Number(data.customer_count ?? 0),
    itemlist_count: Number(data.itemlist_count ?? 0),
    inamt_count: Number(data.inamt_count ?? 0),
    saleetc_count: Number(data.saleetc_count ?? 0),
    sales_count: Number(data.sales_count ?? 0),
    orders_count: Number(data.orders_count ?? 0),
    completed_at: data.completed_at != null ? String(data.completed_at) : null,
    orders_completed_at: data.orders_completed_at != null ? String(data.orders_completed_at) : null,
    status: (data.status as DailyAutoSyncResult["status"]) ?? "success",
  };
}

/**
 * 좌측 패널용: 일괄 동기화 이력. 레거시 주문 전용 행 제외. sync_date 내림차순.
 */
export async function getRecentDailyBatchHistory(limit: number): Promise<DailyAutoSyncResult[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("daily_auto_sync_results")
    .select("*")
    .order("sync_date", { ascending: false })
    .limit(Math.min(limit * 4, 50));
  if (error) return [];
  const rows = (data ?? []).map((r: Record<string, unknown>) => normalizeDailyRow(r));
  const filtered = rows.filter(
    (r: DailyAutoSyncResult) => r.completed_at != null && !isOrdersOnlyDailyRow(r)
  );
  filtered.sort((a: DailyAutoSyncResult, b: DailyAutoSyncResult) => {
    const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return tb - ta;
  });
  return filtered.slice(0, limit);
}

/** 우측 패널용: 매시 cron 이력 */
export async function getRecentHourlySyncResults(limit: number): Promise<HourlySyncResult[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("hourly_sync_results")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => {
    const x = r;
    return {
      id: String(x.id ?? ""),
      completed_at: String(x.completed_at ?? ""),
      status: x.status as HourlySyncResult["status"],
      inamt_count: Number(x.inamt_count ?? 0),
      saleetc_count: Number(x.saleetc_count ?? 0),
      sales_count: Number(x.sales_count ?? 0),
      orders_count: Number(x.orders_count ?? 0),
    };
  });
}

/** @deprecated 목록 조회는 getRecentDailyBatchHistory 사용 */
export async function getRecentDailyAutoSyncResults(limit: number): Promise<DailyAutoSyncResult[]> {
  return getRecentDailyBatchHistory(limit);
}
