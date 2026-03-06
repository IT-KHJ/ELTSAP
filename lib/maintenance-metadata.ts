/**
 * 점검 정보: 점검 내용 및 점검 시간 (null 허용)
 */

import { getSupabaseAdmin } from "./supabase";

export interface MaintenanceInfoRow {
  id: string;
  content: string | null;
  time_from: string | null;
  time_to: string | null;
  updated_at: string;
}

const DEFAULT_ID = "default";

/** 점검 정보 조회 */
export async function getMaintenanceInfo(): Promise<MaintenanceInfoRow | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("maintenance_info")
      .select("*")
      .eq("id", DEFAULT_ID)
      .maybeSingle();
    if (error) return null;
    return data as MaintenanceInfoRow | null;
  } catch {
    return null;
  }
}

/** 점검 정보 저장 (content, time_from, time_to는 null 허용) */
export async function saveMaintenanceInfo(params: {
  content?: string | null;
  time_from?: string | null;
  time_to?: string | null;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const payload: Record<string, unknown> = {
    id: DEFAULT_ID,
    updated_at: new Date().toISOString(),
  };
  if (params.content !== undefined) payload.content = params.content;
  if (params.time_from !== undefined) payload.time_from = params.time_from || null;
  if (params.time_to !== undefined) payload.time_to = params.time_to || null;

  await admin.from("maintenance_info").upsert(payload, { onConflict: "id" });
}
