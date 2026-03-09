-- basecard별 매출 집계 (대시보드용)
-- fetchAllSalesInRange + aggregateSalesByCard 대체
-- docdate 당일 포함: docdate < (p_end + interval '1 day')

CREATE OR REPLACE FUNCTION get_sales_by_basecard(
  p_start date,
  p_end date,
  p_basecard text DEFAULT NULL
)
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
AS $$
  SELECT
    s.basecard::text,
    COALESCE(SUM(CASE WHEN s.totalsumsy > 0 THEN s.totalsumsy ELSE 0 END), 0) AS total_sales,
    COALESCE(SUM(CASE WHEN s.totalsumsy < 0 THEN s.totalsumsy ELSE 0 END), 0) AS total_returns,
    COALESCE(SUM(s.totalsumsy), 0) AS net_sales,
    COUNT(DISTINCT s.docdate::date) AS order_count,
    MAX(s.docdate)::date AS last_order_date
  FROM "SALES" s
  WHERE s.docdate >= p_start
    AND s.docdate < (p_end + interval '1 day')
    AND (p_basecard IS NULL OR s.basecard = p_basecard)
    AND s.basecard IS NOT NULL
    AND TRIM(s.basecard) != ''
  GROUP BY s.basecard
$$;
