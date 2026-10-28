-- 기존 리포트 이전(5단계) 3차: 거래처 현황(판매기준 /sales-status, 판매집계 /sales-status-b)용 (SAP 원본 미러 sap_* 기반)
-- 기준(2026-10-28 사용자 결정): 납품 = 취소되지 않은 전체 납품(ODLN/DLN1 canceled='N'), 부서 조건 ocrcode='24021'(ELT) 유지
--   기존 ORDERS의 LineStatus='O' 조건은 제거(송장 발행 시 'C'로 바뀌어 동기화 시점에 따라 데이터가 달라지던 문제)
--   일자 = 납품 헤더 일자(기존 ORDERS와 동일), 컬럼 이름/계산은 기존 ORDERS와 동일하게 맞춤

-- 리포트용 커버링 인덱스(미러 명세 schema.json 밖, 리포트 계층 소유). 운영 DB에는 CONCURRENTLY로 생성 후 VACUUM ANALYZE 적용함
-- (9개월 전 거래처 집계: 라인 테이블 전체 읽기 8초 → 인덱스만 읽기 0.1초)
CREATE INDEX IF NOT EXISTS idx_rpt_sap_odln_docdate ON public.sap_odln (docdate) INCLUDE (docentry, canceled);
CREATE INDEX IF NOT EXISTS idx_rpt_sap_dln1_docentry ON public.sap_dln1 (docentry)
  INCLUDE (linenum, basecard, ocrcode, itemcode, quantity, pricebefdi, discprcnt, totalsumsy, vatsumsy);

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
       CASE WHEN l.totalsumsy < 0 THEN l.totalsumsy ELSE 0 END AS returnamt
  FROM sap_odln h
  JOIN sap_dln1 l ON l.docentry = h.docentry
  LEFT JOIN sap_ocrd c ON c.cardcode = l.basecard
  LEFT JOIN sap_oitm i ON i.itemcode = l.itemcode
 WHERE h.canceled = 'N' AND COALESCE(l.ocrcode, '') = '24021';

-- 판매기준(/sales-status): 기간 전체 합계 + 요청 페이지 행을 한 번에 반환
-- (기존은 기간 전체 행을 1,000행씩 반복 조회해 앱에서 합산 → 전체 납품 기준에서는 수십~수백 회 호출이 되어 서버에서 처리)
-- 합계 계산은 기존 앱 로직과 동일: 매출 = 양수 합, 반품 = 음수의 절댓값 합, 순매출 = 전체 합
CREATE OR REPLACE FUNCTION public.rpt_sales_status_json(
  p_start date,
  p_end date,
  p_cardcode text DEFAULT NULL,
  p_codes text[] DEFAULT NULL,
  p_sales_type text DEFAULT 'all',
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  WITH f AS (
    SELECT * FROM rpt_delivery_line d
     WHERE d.docdate >= p_start AND d.docdate <= p_end
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
  );
$fn$;

-- 판매집계(/sales-status-b): 거래처별 합계 (기존 앱 그룹화 로직과 동일, 반품금액은 음수 합)
CREATE OR REPLACE FUNCTION public.rpt_sales_status_grouped(
  p_start date,
  p_end date,
  p_sales_type text DEFAULT 'all',
  p_codes text[] DEFAULT NULL
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
SET search_path = public
AS $fn$
  SELECT d.basecard, MAX(d.cardname),
         COALESCE(SUM(d.quantity), 0),
         COALESCE(SUM(d.totalsumsy), 0),
         COALESCE(SUM(d.vatamt), 0),
         COALESCE(SUM(d.totalsumsy + COALESCE(d.vatamt, 0)), 0),
         COALESCE(SUM(d.returnamt), 0)
    FROM rpt_delivery_line d
   WHERE d.docdate >= p_start AND d.docdate <= p_end
     AND (p_codes IS NULL OR d.basecard = ANY (p_codes))
     AND (p_sales_type = 'all'
          OR (p_sales_type = 'sales' AND d.totalsumsy > 0)
          OR (p_sales_type = 'return' AND d.totalsumsy < 0))
     AND d.basecard IS NOT NULL AND TRIM(d.basecard) <> ''
   GROUP BY d.basecard
   ORDER BY d.basecard;
$fn$;

REVOKE ALL ON public.rpt_delivery_line FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_delivery_line TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_status_json(date, date, text, text[], text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_status_json(date, date, text, text[], text, int, int) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_sales_status_grouped(date, date, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_sales_status_grouped(date, date, text, text[]) TO service_role;

NOTIFY pgrst, 'reload schema';
