-- 메뉴 마스터 및 사용자별 메뉴 권한
-- user_profiles + user_menu_permissions 조합으로 사용자 목록 및 권한 관리

-- 1. menus 테이블
CREATE TABLE IF NOT EXISTS public.menus (
  id         TEXT NOT NULL PRIMARY KEY,
  path       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

-- 2. user_menu_permissions 테이블
CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
  email   TEXT NOT NULL REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  menu_id TEXT NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  PRIMARY KEY (email, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_user_menu_permissions_email ON public.user_menu_permissions(email);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service" ON public.menus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public.user_menu_permissions FOR ALL USING (true) WITH CHECK (true);

-- 3. 초기 메뉴 데이터
INSERT INTO public.menus (id, path, label, sort_order)
VALUES
  ('report', '/internal/report', '거래처 현황(마감기준)', 10),
  ('sales-status', '/internal/sales-status', '거래처 현황(판매기준)', 20),
  ('sales-status-b', '/internal/sales-status-b', '거래처 현황(판매집계)', 30),
  ('dashboard', '/internal/dashboard', '거래처 매출 대시보드', 40),
  ('sync', '/internal/sync', '설정', 50),
  ('permissions', '/internal/permissions', '권한 관리', 60)
ON CONFLICT (id) DO NOTHING;

-- 4. 기존 일반 사용자에게 기본 권한 2개 부여 (report, dashboard)
-- admin은 auth.users의 app_metadata/user_metadata role로 판별, 제외
INSERT INTO public.user_menu_permissions (email, menu_id)
SELECT up.email, m.id
FROM public.user_profiles up
CROSS JOIN public.menus m
WHERE m.id IN ('report', 'dashboard')
  AND up.email NOT IN (
    SELECT u.email
    FROM auth.users u
    WHERE (u.raw_app_meta_data->>'role' = 'admin')
       OR (u.raw_user_meta_data->>'role' = 'admin')
  )
ON CONFLICT (email, menu_id) DO NOTHING;
