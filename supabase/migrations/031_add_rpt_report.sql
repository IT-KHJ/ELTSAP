-- 기존 리포트 이전(5단계) 2차: 매출 보고서(/internal/report)용 (SAP 원본 미러 sap_* 기반)
-- 기준은 030_add_rpt_sales.sql과 동일(SAP와 일치, 매출 = 송장 - 대변메모, 부서 2101)
--   입금     = 입금(ORCT) 미취소 — 기존 INAMT와 같은 출처(수동 분개 입금은 기존처럼 제외)
--   증정수량 = 기타출고(OIGE/IGE1) 미취소 라인 — 기존 SALEETC와 같은 조건

-- 기타출고 라인 (기존 SALEETC 대체)
CREATE OR REPLACE VIEW public.rpt_gift_line
WITH (security_invoker = true) AS
SELECT l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode, l.quantity
  FROM sap_ige1 l
  JOIN sap_oige h ON h.docentry = l.docentry
 WHERE h.canceled = 'N';

-- get_sales_by_category_monthly 대체 (품목그룹별 월 합계, 반품만 옵션)
CREATE OR REPLACE FUNCTION public.rpt_sales_by_category_monthly(
  p_basecard text,
  p_start date,
  p_end date,
  p_itmsgrpcod smallint,
  p_returns_only boolean DEFAULT false
)
RETURNS TABLE(month int, total numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    EXTRACT(MONTH FROM s.docdate)::int,
    COALESCE(SUM(s.totalsumsy), 0)
  FROM rpt_sales_line s
  JOIN sap_oitm i ON i.itemcode = s.itemcode
  WHERE s.basecard = p_basecard
    AND s.docdate >= p_start AND s.docdate <= p_end
    AND i.itmsgrpcod = p_itmsgrpcod
    AND (NOT p_returns_only OR s.totalsumsy < 0)
  GROUP BY 1
$fn$;

REVOKE ALL ON public.rpt_gift_line FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_gift_line TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_by_category_monthly(text, date, date, smallint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_by_category_monthly(text, date, date, smallint, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
