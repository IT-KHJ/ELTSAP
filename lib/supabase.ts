import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!u || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  return createClient(u, key, { auth: { persistSession: false } });
}

/**
 * 최신 값이 꼭 보여야 하는 조회 전용(lib/mirror-status.ts 설정 화면 동기화 상태, lib/ledger-queries.ts 거래원장).
 * Next.js가 fetch 응답을 캐싱해 값이 갱신되지 않던 문제 방지.
 * getSupabaseAdmin()과 동작은 동일하고 fetch에 cache:"no-store"만 강제함 — 다른 화면에는 영향 없음.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdminNoCache(): any {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!u || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  return createClient(u, key, {
    auth: { persistSession: false },
    global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) },
  });
}
