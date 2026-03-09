-- 대시보드 총매출/총반품 SQL 집계 (속도 개선)
-- docdate BETWEEN 사용 (TIMESTAMPTZ, 당일 포함은 호출 측에서 endDate+1일로 lt 처리)

CREATE OR REPLACE FUNCTION get_dashboard_sales_agg(
  p_start date,
  p_end date,
  p_basecard text DEFAULT NULL
)
RETURNS TABLE(total_sales numeric, total_returns numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN totalsumsy > 0 THEN totalsumsy ELSE 0 END), 0) AS total_sales,
    COALESCE(SUM(CASE WHEN totalsumsy < 0 THEN totalsumsy ELSE 0 END), 0) AS total_returns
  FROM "SALES"
  WHERE docdate >= p_start
    AND docdate < (p_end + interval '1 day')
    AND (p_basecard IS NULL OR basecard = p_basecard)
$$;
