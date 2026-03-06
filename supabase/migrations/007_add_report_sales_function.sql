-- 거래처 현황 보고서용 매출/반품 월별 집계 함수
-- SALES + ITEMLIST EXISTS 조인으로 사용자 SQL과 동일한 로직 적용

CREATE OR REPLACE FUNCTION get_sales_by_category_monthly(
  p_basecard text,
  p_start date,
  p_end date,
  p_itmsgrpcod smallint,
  p_returns_only boolean DEFAULT false
)
RETURNS TABLE(month int, total numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(MONTH FROM a.docdate)::int AS month,
    COALESCE(SUM(a.totalsumsy), 0) AS total
  FROM "SALES" a
  WHERE a.basecard = p_basecard
    AND a.docdate >= p_start
    AND a.docdate <= p_end
    AND (NOT p_returns_only OR a.totalsumsy < 0)
    AND EXISTS (
      SELECT 1 FROM "ITEMLIST" i
      WHERE i.itemcode = a.itemcode AND i.itmsgrpcod = p_itmsgrpcod
    )
  GROUP BY EXTRACT(MONTH FROM a.docdate)
$$;
