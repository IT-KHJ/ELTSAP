-- 023_fix_rls_always_true_policies.sql 롤백
-- 023에서 삭제된 "Allow all for service" 정책 전체 복원
-- 주의: 023이 이미 적용된 상태(정책 없음)에서만 실행할 것

CREATE POLICY "Allow all for service" ON public.customer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.inamt FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.saleetc FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.itemlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.sync_metadata FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.maintenance_info FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.daily_auto_sync_results FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.menus;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.user_menu_permissions;
CREATE POLICY "Allow all for service" ON public.menus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.user_menu_permissions FOR ALL USING (true) WITH CHECK (true);
