/**
 * 계정별 사용자 이름 조회
 */

import { getSupabaseAdmin } from "./supabase";

/** 이메일로 사용자 표시명 조회. 없으면 null */
export async function getDisplayName(email: string | undefined | null): Promise<string | null> {
  if (!email?.trim()) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("email", email.trim())
      .maybeSingle();
    if (error || !data?.display_name) return null;
    return data.display_name as string;
  } catch {
    return null;
  }
}
