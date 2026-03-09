-- SALES 테이블에 SAP INV1 LineStatus 컬럼 추가
-- LineStatus: 'O'=Open, 'C'=Closed. 기존 데이터는 'O'로 처리하여 조회 대상 유지

ALTER TABLE public."SALES"
  ADD COLUMN IF NOT EXISTS "linestatus" CHAR(1) DEFAULT 'O';

CREATE INDEX IF NOT EXISTS idx_SALES_linestatus ON public."SALES" ("linestatus");

-- get_sales_by_category_monthly: linestatus = 'O' 인 행만 조회
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
    AND COALESCE(a.linestatus, 'O') = 'O'
    AND (NOT p_returns_only OR a.totalsumsy < 0)
    AND EXISTS (
      SELECT 1 FROM "ITEMLIST" i
      WHERE i.itemcode = a.itemcode AND i.itmsgrpcod = p_itmsgrpcod
    )
  GROUP BY EXTRACT(MONTH FROM a.docdate)
$$;

-- get_dashboard_sales_agg: linestatus = 'O' 인 행만 조회
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
    AND COALESCE(linestatus, 'O') = 'O'
$$;

-- get_sales_by_basecard: linestatus = 'O' 인 행만 조회
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
    AND COALESCE(s.linestatus, 'O') = 'O'
  GROUP BY s.basecard
$$;
