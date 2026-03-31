-- sido (시도), sigun (시군구) 컬럼 추가
-- 기존 거래처는 NULL로 시작 (지역정보 없음, 강제 입력 불필요)
ALTER TABLE public."CUSTOMER"
  ADD COLUMN IF NOT EXISTS "sido"  TEXT,
  ADD COLUMN IF NOT EXISTS "sigun" TEXT;
