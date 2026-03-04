import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 클라이언트(브라우저)용. RLS 적용. 런타임에 URL/Key 없으면 사용 시 오류 */
export const supabase = createClient<Database>(url, anonKey);

/** 서버 전용. RLS 우회, 동기화/보고서 API에서 사용 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): any {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!u || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key");
  return createClient(u, key, { auth: { persistSession: false } });
}
