-- Fix: hourly_sync_results의 RLS가 운영 DB에서 비활성화되어 있음.
-- 기존 정책(USING true, 역할 제한 없음)은 공개 접근을 허용함.
-- 앱 접근은 모두 service_role을 사용하며 RLS를 우회함 — 별도 정책 불필요.

ALTER TABLE public.hourly_sync_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service hourly_sync" ON public.hourly_sync_results;
