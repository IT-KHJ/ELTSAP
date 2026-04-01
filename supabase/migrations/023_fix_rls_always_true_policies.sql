-- ============================================================
-- Group A: 서버 전용 테이블 (service_role만 사용)
-- 정책 삭제 → service_role은 RLS 우회, anon/authenticated 기본 차단
-- ============================================================

DROP POLICY IF EXISTS "Allow all for service" ON public.customer;
DROP POLICY IF EXISTS "Allow all for service" ON public.sales;
DROP POLICY IF EXISTS "Allow all for service" ON public.orders;
DROP POLICY IF EXISTS "Allow all for service" ON public.inamt;
DROP POLICY IF EXISTS "Allow all for service" ON public.saleetc;
DROP POLICY IF EXISTS "Allow all for service" ON public.itemlist;
DROP POLICY IF EXISTS "Allow all for service" ON public.sync_metadata;
DROP POLICY IF EXISTS "Allow all for service" ON public.maintenance_info;
DROP POLICY IF EXISTS "Allow all for service" ON public.daily_auto_sync_results;

-- ============================================================
-- Group B: 인증 사용자 접근 테이블
-- 기존 정책 교체 → authenticated 역할만 허용 (anon 차단)
-- admin 체크는 앱 코드(isAdminUser)에서 처리
-- ============================================================

DROP POLICY IF EXISTS "Allow all for service" ON public.menus;
DROP POLICY IF EXISTS "Allow all for service" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all for service" ON public.user_menu_permissions;

CREATE POLICY "Allow all for authenticated" ON public.menus
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON public.user_menu_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
