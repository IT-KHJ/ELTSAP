-- B안 거래처 현황(판매기준) 그룹화 조회용 함수
-- 판매수량, 매출금액, 세액, 총금액, 반품금액 (사용자 쿼리 구조 반영)

CREATE OR REPLACE FUNCTION get_sales_status_grouped(
  p_start date,
  p_end date,
  p_sales_type text DEFAULT 'all'
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
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.basecard::text,
    (SELECT c.cardname FROM "CUSTOMER" c WHERE c.cardcode = a.basecard) AS cardname,
    SUM(a.quantity) AS quantity,
    SUM(a.totalsumsy) AS sales_amount,
    SUM(COALESCE(a.vatsumsy, 0)) AS vat_amount,
    SUM(a.totalsumsy + COALESCE(a.vatsumsy, 0)) AS total_amount,
    ABS(SUM(CASE WHEN a.totalsumsy < 0 THEN a.totalsumsy ELSE 0 END)) AS return_amount
  FROM (
    SELECT
      s.basecard,
      s.quantity,
      s.totalsumsy,
      s.vatsumsy
    FROM "SALES" s
    WHERE s.docdate::date >= p_start
      AND s.docdate::date <= p_end
      AND COALESCE(s.linestatus, 'O') = 'O'
      AND (
        (p_sales_type = 'all')
        OR (p_sales_type = 'sales' AND s.totalsumsy > 0)
        OR (p_sales_type = 'return' AND s.totalsumsy < 0)
      )
  ) a
  WHERE a.basecard IS NOT NULL AND TRIM(a.basecard) != ''
  GROUP BY a.basecard
$$;
