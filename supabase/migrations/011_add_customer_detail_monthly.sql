-- 거래처 상세 월별 매출/반품 집계 (get_sales_by_basecard와 동일 로직)
-- totalsumsy > 0 = 매출, totalsumsy < 0 = 반품, linestatus = 'O'

CREATE OR REPLACE FUNCTION get_customer_detail_monthly(
  p_basecard text,
  p_start date,
  p_end date
)
RETURNS TABLE(
  month text,
  sales numeric,
  returns numeric,
  net_sales numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    TO_CHAR(s.docdate, 'YYYY-MM') AS month,
    COALESCE(SUM(CASE WHEN s.totalsumsy > 0 THEN s.totalsumsy ELSE 0 END), 0) AS sales,
    COALESCE(SUM(CASE WHEN s.totalsumsy < 0 THEN s.totalsumsy ELSE 0 END), 0) AS returns,
    COALESCE(SUM(s.totalsumsy), 0) AS net_sales
  FROM "SALES" s
  WHERE s.basecard = p_basecard
    AND s.docdate >= p_start
    AND s.docdate < (p_end + interval '1 day')
    AND COALESCE(s.linestatus, 'O') = 'O'
  GROUP BY TO_CHAR(s.docdate, 'YYYY-MM')
  ORDER BY month
$$;
