-- 거래원장 매출 기준을 납품 → 송장으로 변경 (2026-10-30 사용자 결정: SAP 채권 잔액과 동일하게)
-- 납품 기준에서는 SAP 안에서 물류(납품/반품)만 처리되고 회계(송장/대변메모)가 처리되지 않은 문서 때문에
-- 9/30 잔액 15곳이 SAP 채권(JDT1)과 달랐음(예: C001242 오등록 납품 상계 후 송장 미취소 -485,700). 송장 기준 시뮬레이션 183곳 전부 일치.
--   매출    : AR 송장 전 라인(OINV/INV1, canceled 'N','Y' — 'Y' 송장은 대응하는 'Y' 대변메모와 상쇄)
--   대변메모: AR 대변메모(ORIN/RIN1, canceled 'N','Y') — 027과 동일
--   납품(ODLN)·반품(ORDN) 행은 제외
--   행 날짜 = 라인 날짜(INV1/RIN1.DocDate = 납품일). 송장은 대부분 월말 일괄 발행이므로 화면은 납품일별로 보이고,
--             월말 잔액은 SAP와 일치(월 중간 잔액은 미청구분 포함). 문서번호·비고는 송장/대변메모 기준
--   입금/채권조정: rpt_payment (032, 036) — 변경 없음

CREATE OR REPLACE FUNCTION public.rpt_ledger(p_cardcode text, p_start date, p_end date)
RETURNS TABLE (
  seq bigint,
  txdate date,
  docnum integer,
  gubun text,
  descr text,
  qty numeric,
  occur numeric,
  cancel numeric,
  collect numeric,
  balance numeric,
  remark text,
  source text
)
LANGUAGE sql
STABLE
SET search_path = public
SET enable_hashjoin = off
SET enable_mergejoin = off
AS $fn$
WITH ev AS (
  SELECT COALESCE(l.docdate, h.docdate) AS txdate, 1 AS grp, h.docnum, l.linenum AS sub,
         '매출'::text AS gubun, l.dscription AS descr, l.quantity AS qty,
         l.linetotal + COALESCE(l.vatsum, 0) AS occur, 0::numeric AS cancel,
         0::numeric AS collect, h.comments AS remark, 'OINV'::text AS source
    FROM sap_oinv h
    JOIN sap_inv1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled IN ('N', 'Y')
     AND COALESCE(l.docdate, h.docdate) <= p_end
  UNION ALL
  SELECT COALESCE(l.docdate, h.docdate), 1, h.docnum, l.linenum, '대변메모', l.dscription, -l.quantity,
         0, l.linetotal + COALESCE(l.vatsum, 0), 0, h.comments, 'ORIN'
    FROM sap_orin h
    JOIN sap_rin1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled IN ('N', 'Y')
     AND COALESCE(l.docdate, h.docdate) <= p_end
  UNION ALL
  SELECT p.txdate, 2, NULL, p.sub, p.gubun, p.descr, NULL, 0, 0, p.amount, p.remark, p.source
    FROM rpt_payment p
   WHERE p.cardcode = p_cardcode AND p.txdate <= p_end
),
opening AS (
  SELECT COALESCE(sum(occur - cancel - collect), 0) AS bal FROM ev WHERE txdate < p_start
),
cur AS (
  SELECT * FROM ev WHERE txdate >= p_start
)
SELECT 0::bigint, NULL::date, NULL::integer, '전기이월', NULL::text, NULL::numeric,
       0::numeric, 0::numeric, 0::numeric, (SELECT bal FROM opening), NULL::text, NULL::text
UNION ALL
SELECT row_number() OVER w,
       txdate, docnum, gubun, descr, qty, occur, cancel, collect,
       (SELECT bal FROM opening) + sum(occur - cancel - collect) OVER (w ROWS UNBOUNDED PRECEDING),
       remark, source
  FROM cur
WINDOW w AS (ORDER BY txdate, grp, docnum NULLS LAST, sub, source)
ORDER BY 1;
$fn$;

NOTIFY pgrst, 'reload schema';
