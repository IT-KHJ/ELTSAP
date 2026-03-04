import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 클라이언트(브라우저)용. RLS 적용. 빌드 시 env 없어도 모듈 로드만 하면 오류 나지 않도록 지연 생성 */
let _supabase: SupabaseClient<Database> | null = null;
function getSupabaseClient(): SupabaseClient<Database> {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  _supabase = createClient<Database>(url, anonKey);
  return _supabase;
}
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient<Database>];
  },
});

/** 서버 전용. RLS 우회, 동기화/보고서 API에서 사용. 빌드 시 호출되지 않도록 API 핸들러 내부에서만 호출 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): any {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!u || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key");
  return createClient(u, key, { auth: { persistSession: false } });
}
