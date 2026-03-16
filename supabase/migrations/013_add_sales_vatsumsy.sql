-- SALES 테이블에 SAP INV1 vatsumsy 컬럼 추가
-- vatsumsy: 부가세 합계 (numeric(19,6), Null)

ALTER TABLE public."SALES"
  ADD COLUMN IF NOT EXISTS "vatsumsy" NUMERIC(19, 6) NULL;
