-- 사업부(ELT / 중고등) 구분 (9단계, 2026-11-05 사용자 결정)
-- 리포트 기준 = 사업부 거래처 × 사업부 부서. 전체 = ELT + 중고등(중복 없음)
--   예) 중고등 지사가 산 ELT 부서(2101) 상품은 ELT·중고등 어느 쪽에도 넣지 않음 (기존에 ELT 거래처의 NE Times 상품이 빠지는 것과 같은 방식)
-- 거래처 소속: 미러 등록부(sap_mirror_customers.segment) — 동기화 엔진이 schema.json의 사업부 조건으로 채움
-- 부서 코드: 이 파일의 rpt_segment (리포트 계층 소유)
-- 함수의 p_segment: 'ELT'(기본값, 기존 호출과 동일 결과) | '중고등' | 'ALL'(전체)

-- 1) 등록부에 사업부 컬럼 (기존 등록 거래처는 모두 ELT)
ALTER TABLE public.sap_mirror_customers ADD COLUMN IF NOT EXISTS "segment" text;
UPDATE public.sap_mirror_customers SET segment = 'ELT' WHERE segment IS NULL;

-- 2) 사업부별 부서 코드
CREATE TABLE IF NOT EXISTS public.rpt_segment (
  "segment"       text PRIMARY KEY,
  "dln_ocrcodes"  text[] NOT NULL,   -- 납품 라인 부서(DLN1.OcrCode)
  "inv_ocrcode2s" text[] NOT NULL,   -- 송장/대변메모 라인 부서(INV1/RIN1.OcrCode2)
  "sort_order"    int NOT NULL
);
ALTER TABLE public.rpt_segment ENABLE ROW LEVEL SECURITY;
INSERT INTO public.rpt_segment (segment, dln_ocrcodes, inv_ocrcode2s, sort_order) VALUES
  ('ELT',    ARRAY['24021'],          ARRAY['2101'],         1),  -- ELT영업팀 / ELT국내
  ('중고등', ARRAY['24022', '24023', '22030', '22060'], ARRAY['2102', '2103', '2601', '2801'], 2)   -- 중고등영업팀 영어·수험·수학·국어사업파트 / 송장 부서(영어·수험영어·수학·국어) — 수학·국어는 2026-11-06 사용자 결정(SAP 기준)
ON CONFLICT (segment) DO UPDATE
  SET dln_ocrcodes = EXCLUDED.dln_ocrcodes, inv_ocrcode2s = EXCLUDED.inv_ocrcode2s, sort_order = EXCLUDED.sort_order;

-- 3) 매출 라인: 부서 조건을 거래처 사업부의 부서 코드로 (컬럼 segment 추가)
CREATE OR REPLACE VIEW public.rpt_sales_line
WITH (security_invoker = true) AS
SELECT 'INV'::text AS source, l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       l.quantity, l.totalsumsy, l.vatsumsy, m.segment
  FROM sap_inv1 l
  JOIN sap_oinv h ON h.docentry = l.docentry
  JOIN sap_mirror_customers m ON m.cardcode = l.basecard
  JOIN rpt_segment s ON s.segment = m.segment AND l.ocrcode2 = ANY (s.inv_ocrcode2s)
 WHERE h.canceled = 'N'
UNION ALL
SELECT 'RIN', l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       -l.quantity, -l.totalsumsy, -l.vatsumsy, m.segment
  FROM sap_rin1 l
  JOIN sap_orin h ON h.docentry = l.docentry
  JOIN sap_mirror_customers m ON m.cardcode = l.basecard
  JOIN rpt_segment s ON s.segment = m.segment AND l.ocrcode2 = ANY (s.inv_ocrcode2s)
 WHERE h.canceled = 'N';

-- 4) 납품 라인 (컬럼 segment 추가)
CREATE OR REPLACE VIEW public.rpt_delivery_line
WITH (security_invoker = true) AS
SELECT l.docentry,
       l.linenum,
       h.docdate,
       l.basecard,
       c.cardname,
       c.aliasname,
       l.itemcode,
       i.itemname,
       l.pricebefdi AS price,
       ROUND(100 - COALESCE(l.discprcnt, 0), 0) AS supply_rate,
       ROUND(COALESCE(l.discprcnt, 0), 0) AS discount_rate,
       l.quantity,
       l.totalsumsy,
       l.vatsumsy AS vatamt,
       CASE WHEN l.totalsumsy < 0 THEN l.totalsumsy ELSE 0 END AS returnamt,
       m.segment
  FROM sap_odln h
  JOIN sap_dln1 l ON l.docentry = h.docentry
  JOIN sap_mirror_customers m ON m.cardcode = l.basecard
  JOIN rpt_segment s ON s.segment = m.segment AND l.ocrcode = ANY (s.dln_ocrcodes)
  LEFT JOIN sap_ocrd c ON c.cardcode = l.basecard
  LEFT JOIN sap_oitm i ON i.itemcode = l.itemcode
 WHERE h.canceled = 'N';

-- 5) 거래처 (컬럼 segment 추가)
CREATE OR REPLACE VIEW public.rpt_customer
WITH (security_invoker = true) AS
SELECT o.cardcode, o.cardname, o.aliasname, COALESCE(c.useyn, 'Y') AS useyn, c.sido, c.sigun,
       o.address, o.phone1, o.phone2, o.cntctprsn, o.repname, m.segment
  FROM sap_ocrd o
  JOIN sap_mirror_customers m ON m.cardcode = o.cardcode AND m.elt
  LEFT JOIN public.customer c ON c.cardcode = o.cardcode;

-- 6) 전 거래처 집계 함수에 p_segment 추가 (인자 목록이 바뀌므로 기존 함수 삭제 후 생성)
DROP FUNCTION IF EXISTS public.rpt_dashboard_sales_agg(date, date, text);
CREATE OR REPLACE FUNCTION public.rpt_dashboard_sales_agg(p_start date, p_end date, p_basecard text DEFAULT NULL, p_segment text DEFAULT 'ELT')
RETURNS TABLE(total_sales numeric, total_returns numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    COALESCE(SUM(CASE WHEN totalsumsy > 0 THEN totalsumsy ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN totalsumsy < 0 THEN totalsumsy ELSE 0 END), 0)
  FROM rpt_sales_line
  WHERE docdate >= p_start AND docdate <= p_end
    AND (p_basecard IS NULL OR basecard = p_basecard)
    AND (p_segment = 'ALL' OR segment = p_segment)
$fn$;

DROP FUNCTION IF EXISTS public.rpt_sales_by_basecard(date, date, text);
CREATE OR REPLACE FUNCTION public.rpt_sales_by_basecard(p_start date, p_end date, p_basecard text DEFAULT NULL, p_segment text DEFAULT 'ELT')
RETURNS TABLE(
  basecard text,
  total_sales numeric,
  total_returns numeric,
  net_sales numeric,
  order_count bigint,
  last_order_date date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    s.basecard::text,
    COALESCE(SUM(CASE WHEN s.totalsumsy > 0 THEN s.totalsumsy ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.totalsumsy < 0 THEN s.totalsumsy ELSE 0 END), 0),
    COALESCE(SUM(s.totalsumsy), 0),
    COUNT(DISTINCT s.docdate),
    MAX(s.docdate)
  FROM rpt_sales_line s
  WHERE s.docdate >= p_start AND s.docdate <= p_end
    AND (p_basecard IS NULL OR s.basecard = p_basecard)
    AND (p_segment = 'ALL' OR s.segment = p_segment)
    AND s.basecard IS NOT NULL AND TRIM(s.basecard) <> ''
  GROUP BY s.basecard
$fn$;

DROP FUNCTION IF EXISTS public.rpt_sales_status_json(date, date, text, text[], text, int, int);
CREATE OR REPLACE FUNCTION public.rpt_sales_status_json(
  p_start date,
  p_end date,
  p_cardcode text DEFAULT NULL,
  p_codes text[] DEFAULT NULL,
  p_sales_type text DEFAULT 'all',
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 100,
  p_segment text DEFAULT 'ELT'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $fn$
-- plpgsql + custom plan: SQL 함수는 인자 값을 모르는 일반 계획으로 실행되어, 행 수 오추정으로
-- 거래처 등록부와 중첩 루프 조인(9개월 집계 0.3초 → 3.5초 이상)이 되는 것을 막는다 (2026-11-05 측정)
BEGIN
  RETURN (
  WITH f AS (
    SELECT * FROM rpt_delivery_line d
     WHERE d.docdate >= p_start AND d.docdate <= p_end
       AND (p_segment = 'ALL' OR d.segment = p_segment)
       AND (p_cardcode IS NULL OR d.basecard ILIKE '%' || p_cardcode || '%')
       AND (p_codes IS NULL OR d.basecard = ANY (p_codes))
       AND (p_sales_type = 'all'
            OR (p_sales_type = 'sales' AND d.totalsumsy > 0)
            OR (p_sales_type = 'return' AND d.totalsumsy < 0))
  ),
  page AS (
    SELECT * FROM f
     ORDER BY docdate, basecard, itemcode, docentry, linenum
    OFFSET p_offset LIMIT p_limit + 1
  )
  SELECT jsonb_build_object(
    'total_sales',   (SELECT COALESCE(SUM(totalsumsy) FILTER (WHERE totalsumsy > 0), 0) FROM f),
    'total_returns', (SELECT COALESCE(-SUM(totalsumsy) FILTER (WHERE totalsumsy < 0), 0) FROM f),
    'net_sales',     (SELECT COALESCE(SUM(totalsumsy), 0) FROM f),
    'rows', (SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY docdate, basecard, itemcode, docentry, linenum), '[]'::jsonb) FROM page)
  ));
END;
$fn$;

DROP FUNCTION IF EXISTS public.rpt_sales_status_grouped(date, date, text, text[]);
CREATE OR REPLACE FUNCTION public.rpt_sales_status_grouped(
  p_start date,
  p_end date,
  p_sales_type text DEFAULT 'all',
  p_codes text[] DEFAULT NULL,
  p_segment text DEFAULT 'ELT'
)
RETURNS TABLE(
  basecard text,
  cardname text,
  quantity numeric,
  sales_amount numeric,
  vat_amount numeric,
  total_amount numeric,
  return_amount numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
SET plan_cache_mode = force_custom_plan
AS $fn$
-- plpgsql + custom plan: rpt_sales_status_json과 같은 이유
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT d.basecard, MAX(d.cardname),
         COALESCE(SUM(d.quantity), 0),
         COALESCE(SUM(d.totalsumsy), 0),
         COALESCE(SUM(d.vatamt), 0),
         COALESCE(SUM(d.totalsumsy + COALESCE(d.vatamt, 0)), 0),
         COALESCE(SUM(d.returnamt), 0)
    FROM rpt_delivery_line d
   WHERE d.docdate >= p_start AND d.docdate <= p_end
     AND (p_segment = 'ALL' OR d.segment = p_segment)
     AND (p_codes IS NULL OR d.basecard = ANY (p_codes))
     AND (p_sales_type = 'all'
          OR (p_sales_type = 'sales' AND d.totalsumsy > 0)
          OR (p_sales_type = 'return' AND d.totalsumsy < 0))
     AND d.basecard IS NOT NULL AND TRIM(d.basecard) <> ''
   GROUP BY d.basecard
   ORDER BY d.basecard;
END;
$fn$;

REVOKE ALL ON public.rpt_segment FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_segment TO service_role;
REVOKE ALL ON public.rpt_sales_line, public.rpt_delivery_line, public.rpt_customer FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_sales_line, public.rpt_delivery_line, public.rpt_customer TO service_role;
REVOKE ALL ON FUNCTION public.rpt_dashboard_sales_agg(date, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_dashboard_sales_agg(date, date, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_by_basecard(date, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_by_basecard(date, date, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_status_json(date, date, text, text[], text, int, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_status_json(date, date, text, text[], text, int, int, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_status_grouped(date, date, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_status_grouped(date, date, text, text[], text) TO service_role;

NOTIFY pgrst, 'reload schema';
