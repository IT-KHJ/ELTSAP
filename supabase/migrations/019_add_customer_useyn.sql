-- useyn 컬럼 추가 (기본값 Y, 기존 데이터는 Y로 세팅)
ALTER TABLE public."CUSTOMER"
  ADD COLUMN IF NOT EXISTS "useyn" TEXT NOT NULL DEFAULT 'Y';

-- 혹시 DEFAULT가 적용 안 된 기존 행 대비
UPDATE public."CUSTOMER" SET "useyn" = 'Y' WHERE "useyn" IS NULL OR "useyn" = '';

-- SAP sync 측에서 useyn을 upsert 페이로드에 포함하지 않는 방식으로 보존
-- (트리거 불필요 — 관리 UI에서 useyn 수정이 트리거에 의해 차단되는 문제 방지)

-- menus 테이블에 거래처 관리 메뉴 추가 (sort_order 0 = 최상단)
INSERT INTO public.menus (path, label, sort_order)
VALUES ('/internal/customers', '거래처 관리', 0)
ON CONFLICT (path) DO NOTHING;
