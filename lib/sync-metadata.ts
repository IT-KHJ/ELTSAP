/**
 * 동기화 메타데이터: 엔티티별 마지막 동기화 시각 및 건수
 */

import { getSupabaseAdmin } from "./supabase";

export type SyncEntityType = "customer" | "itemlist" | "sales" | "inamt" | "saleetc";

export interface SyncMetadataRow {
  entity_type: string;
  last_synced_at: string;
  inserted_count: number;
  updated_count: number;
  total_count: number;
}

/** Supabase timestamptz 형식(예: 2026-03-05 05:03:23.982+00)을 JavaScript Date가 파싱 가능한 ISO 8601로 변환 */
export function normalizeTimestampForParse(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;
  let s = raw.trim();
  if (s.length >= 19 && s[10] === " ") {
    s = s.slice(0, 10) + "T" + s.slice(11);
  }
  if (s.endsWith("+00")) s = s.slice(0, -3) + "+00:00";
  else if (s.endsWith("-00")) s = s.slice(0, -3) + "-00:00";
  return s;
}

/** 마지막 동기화 시각 조회 (증분 동기화용). 없으면 null. YYYY-MM-DD(날짜만) 반환. SAP CreateDate/UpdateDate와 동일하게 날짜 단위 비교 */
export async function getLastSyncTime(entityType: SyncEntityType): Promise<string | null> {
  const r = await getLastSyncTimeDebug(entityType);
  return r && "since" in r ? r.since : null;
}

/** 마지막 동기화 시각 + 원본값 (디버깅용). error 있으면 _debug에 포함 */
export async function getLastSyncTimeDebug(
  entityType: SyncEntityType
): Promise<{ raw: string; since: string } | { error: string } | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("sync_metadata")
      .select("last_synced_at")
      .eq("entity_type", entityType)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data?.last_synced_at) return null;
    const raw = data.last_synced_at as string;
    const normalized = normalizeTimestampForParse(raw);
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return { error: `날짜 파싱 실패: ${raw}` };
    return { raw, since: d.toISOString().slice(0, 10) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** 동기화 완료 후 메타데이터 저장 */
export async function saveSyncMetadata(
  entityType: SyncEntityType,
  result: { inserted: number; updated: number }
): Promise<void> {
  const total = result.inserted + result.updated;
  const admin = getSupabaseAdmin();
  await admin.from("sync_metadata").upsert(
    {
      entity_type: entityType,
      last_synced_at: new Date().toISOString(),
      inserted_count: result.inserted,
      updated_count: result.updated,
      total_count: total,
    },
    { onConflict: "entity_type" }
  );
}

/** 모든 엔티티의 동기화 메타데이터 조회 */
export async function getAllSyncMetadata(): Promise<SyncMetadataRow[]> {
  const r = await getAllSyncMetadataWithError();
  return r.error ? [] : r.data;
}

const ALL_ENTITY_TYPES: SyncEntityType[] = ["customer", "itemlist", "sales", "inamt", "saleetc"];

/** 메타데이터 조회 + 오류 (디버깅용). entity_type별 개별 조회로 모든 행 확보 */
export async function getAllSyncMetadataWithError(): Promise<{ data: SyncMetadataRow[]; error: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    const results: SyncMetadataRow[] = [];
    for (const entityType of ALL_ENTITY_TYPES) {
      const { data, error } = await admin
        .from("sync_metadata")
        .select("*")
        .eq("entity_type", entityType)
        .maybeSingle();
      if (error) return { data: [], error: error.message };
      if (data) results.push(data as SyncMetadataRow);
    }
    return { data: results, error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e.message : String(e) };
  }
}

const ENTITY_TO_TABLE: Record<SyncEntityType, string> = {
  customer: "CUSTOMER",
  itemlist: "ITEMLIST",
  sales: "SALES",
  inamt: "INAMT",
  saleetc: "SALEETC",
};

/** 각 엔티티 테이블의 누적 행 수 조회 */
export async function getSyncTableCounts(): Promise<Record<string, number>> {
  const admin = getSupabaseAdmin();
  const result: Record<string, number> = {};
  for (const [entity, table] of Object.entries(ENTITY_TO_TABLE)) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    result[entity] = error ? 0 : (count ?? 0);
  }
  return result;
}

/** 단일 엔티티 테이블의 행 수 조회 (동기화 직후 같은 연결에서 조회용) */
export async function getTableCount(entityType: SyncEntityType): Promise<number> {
  const table = ENTITY_TO_TABLE[entityType];
  if (!table) return 0;
  try {
    const admin = getSupabaseAdmin();
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}
