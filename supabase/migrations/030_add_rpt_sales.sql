-- 기존 리포트 이전(5단계) 1차: 매출 공통 뷰 + 거래처 대시보드용 함수 (SAP 원본 미러 sap_* 기반)
-- 기존 get_* 함수와 SALES/CUSTOMER 테이블은 그대로 둔다(화면 전환 후 6단계에서 정리).
-- 기준(2026-10-28 사용자 결정): 숫자는 SAP와 맞춘다(기존 화면 숫자에 맞추지 않음)
--   매출 = AR 송장 라인(INV1, 미취소) - AR 대변메모 라인(RIN1, 미취소), 부서 조건 ocrcode2='2101'(ELT) 유지
--          기존 LineStatus='O' 조건 대신 대변메모를 직접 차감(부분 대변메모도 정확, 2025년 기준 결과 동일)
--   일자   = 라인 일자(INV1.DocDate = 납품일, 기존 SALES와 동일 기준). 송장 헤더 일자와는 같은 달 안에서만 차이
--   거래처 = 라인 BaseCard(기존과 동일, 미러 범위 2024~ 헤더 거래처와 100% 일치)

-- 리포트용 커버링 인덱스(미러 명세 schema.json 밖, 리포트 계층 소유): 전 거래처 기간 집계를 인덱스만으로 처리
-- (2026 연간 집계 1.0초 → 0.3초, 첫 조회 7.9초 문제 해소). 운영 DB에는 CONCURRENTLY로 생성 후 VACUUM ANALYZE 적용함
CREATE INDEX IF NOT EXISTS idx_rpt_sap_inv1_docdate ON public.sap_inv1 (docdate)
  INCLUDE (docentry, linenum, basecard, ocrcode2, itemcode, quantity, totalsumsy, vatsumsy);

-- 매출 라인: 송장(+) / 대변메모(-)
CREATE OR REPLACE VIEW public.rpt_sales_line
WITH (security_invoker = true) AS
SELECT 'INV'::text AS source, l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       l.quantity, l.totalsumsy, l.vatsumsy
  FROM sap_inv1 l
  JOIN sap_oinv h ON h.docentry = l.docentry
 WHERE h.canceled = 'N' AND COALESCE(l.ocrcode2, '') = '2101'
UNION ALL
SELECT 'RIN', l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       -l.quantity, -l.totalsumsy, -l.vatsumsy
  FROM sap_rin1 l
  JOIN sap_orin h ON h.docentry = l.docentry
 WHERE h.canceled = 'N' AND COALESCE(l.ocrcode2, '') = '2101';

-- 거래처: SAP 마스터(ELT 미러 대상) + 앱에서 관리하는 로컬 값(useyn/sido/sigun, 기존 customer 테이블)
CREATE OR REPLACE VIEW public.rpt_customer
WITH (security_invoker = true) AS
SELECT o.cardcode, o.cardname, o.aliasname, c.useyn, c.sido, c.sigun
  FROM sap_ocrd o
  JOIN sap_mirror_customers m ON m.cardcode = o.cardcode AND m.elt
  LEFT JOIN public.customer c ON c.cardcode = o.cardcode;

-- get_dashboard_sales_agg 대체
CREATE OR REPLACE FUNCTION public.rpt_dashboard_sales_agg(p_start date, p_end date, p_basecard text DEFAULT NULL)
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
$fn$;

-- get_sales_by_basecard 대체
CREATE OR REPLACE FUNCTION public.rpt_sales_by_basecard(p_start date, p_end date, p_basecard text DEFAULT NULL)
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
    AND s.basecard IS NOT NULL AND TRIM(s.basecard) <> ''
  GROUP BY s.basecard
$fn$;

-- get_customer_detail_monthly 대체
CREATE OR REPLACE FUNCTION public.rpt_customer_detail_monthly(p_basecard text, p_start date, p_end date)
RETURNS TABLE(month text, sales numeric, returns numeric, net_sales numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    TO_CHAR(s.docdate, 'YYYY-MM'),
    COALESCE(SUM(CASE WHEN s.totalsumsy > 0 THEN s.totalsumsy ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.totalsumsy < 0 THEN s.totalsumsy ELSE 0 END), 0),
    COALESCE(SUM(s.totalsumsy), 0)
  FROM rpt_sales_line s
  WHERE s.basecard = p_basecard AND s.docdate >= p_start AND s.docdate <= p_end
  GROUP BY 1
  ORDER BY 1
$fn$;

REVOKE ALL ON public.rpt_sales_line, public.rpt_customer FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_sales_line, public.rpt_customer TO service_role;
REVOKE ALL ON FUNCTION public.rpt_dashboard_sales_agg(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_dashboard_sales_agg(date, date, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_by_basecard(date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_by_basecard(date, date, text) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_customer_detail_monthly(text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_customer_detail_monthly(text, date, date) TO service_role;

NOTIFY pgrst, 'reload schema';
