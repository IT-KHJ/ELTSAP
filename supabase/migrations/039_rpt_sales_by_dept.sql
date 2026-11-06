-- 거래처 현황(마감기준) 중고등 과목별 하위 행 (2026-11-06 사용자 결정: B안, 영어 포함)
-- "중고등 매출/반품"(제품, itmsgrpcod 100) 합계 아래 영어/수학/국어 하위 행 — 과목은 SAP 판매 부서(INV1/RIN1.OcrCode2) 기준
-- 부서 → 과목 매핑과 표시 여부 판단은 lib/report-queries.ts (getSubjectBreakdown)

-- 1) 매출 라인에 부서 컬럼 추가 (뒤에 덧붙임 — 기존 컬럼·결과 무변경)
CREATE OR REPLACE VIEW public.rpt_sales_line
WITH (security_invoker = true) AS
SELECT 'INV'::text AS source, l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       l.quantity, l.totalsumsy, l.vatsumsy, m.segment, l.ocrcode2
  FROM sap_inv1 l
  JOIN sap_oinv h ON h.docentry = l.docentry
  JOIN sap_mirror_customers m ON m.cardcode = l.basecard
  JOIN rpt_segment s ON s.segment = m.segment AND l.ocrcode2 = ANY (s.inv_ocrcode2s)
 WHERE h.canceled = 'N'
UNION ALL
SELECT 'RIN', l.docentry, l.linenum, l.docdate, l.basecard, l.itemcode,
       -l.quantity, -l.totalsumsy, -l.vatsumsy, m.segment, l.ocrcode2
  FROM sap_rin1 l
  JOIN sap_orin h ON h.docentry = l.docentry
  JOIN sap_mirror_customers m ON m.cardcode = l.basecard
  JOIN rpt_segment s ON s.segment = m.segment AND l.ocrcode2 = ANY (s.inv_ocrcode2s)
 WHERE h.canceled = 'N';

-- 2) 부서별 월 합계 (rpt_sales_by_category_monthly와 같은 조건, 부서로 나눔)
--    total = 순매출(매출 행과 같은 기준), returns = 반품(음수 라인만)
CREATE OR REPLACE FUNCTION public.rpt_sales_by_dept_monthly(
  p_basecard text,
  p_start date,
  p_end date,
  p_itmsgrpcod smallint
)
RETURNS TABLE(ocrcode2 text, month int, total numeric, returns numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT
    s.ocrcode2::text,
    EXTRACT(MONTH FROM s.docdate)::int,
    COALESCE(SUM(s.totalsumsy), 0),
    COALESCE(SUM(s.totalsumsy) FILTER (WHERE s.totalsumsy < 0), 0)
  FROM rpt_sales_line s
  JOIN sap_oitm i ON i.itemcode = s.itemcode
  WHERE s.basecard = p_basecard
    AND s.docdate >= p_start AND s.docdate <= p_end
    AND i.itmsgrpcod = p_itmsgrpcod
  GROUP BY 1, 2
$fn$;

REVOKE ALL ON FUNCTION public.rpt_sales_by_dept_monthly(text, date, date, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_by_dept_monthly(text, date, date, smallint) TO service_role;

NOTIFY pgrst, 'reload schema';
