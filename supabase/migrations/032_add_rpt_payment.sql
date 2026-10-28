-- 입금/채권조정 공통 규칙 (2026-10-28 사용자 결정: 거래처 현황(마감기준) 입금을 거래원장과 동일 기준으로)
-- 규칙은 027_add_rpt_ledger.sql의 입금 규칙을 그대로 옮긴 것이며, rpt_ledger도 이 뷰를 쓰도록 바꿔 한 곳에서 관리한다.
--   입금        : 입금 문서(ORCT) 미취소
--   입금/채권조정: 거래처 계정 수동 분개(JDT1 TransType 30) 분개별 순액, 차대 상쇄(0) 분개 제외.
--                 메모에 기초잔액/상계/조정/대손/입금처 변경 포함 시 '채권조정', 그 외 '입금'

CREATE OR REPLACE VIEW public.rpt_payment
WITH (security_invoker = true) AS
SELECT 'ORCT'::text AS source, h.cardcode, h.docdate AS txdate, h.docentry AS sub,
       '입금'::text AS gubun, h.jrnlmemo AS descr, h.doctotal AS amount, h.comments AS remark
  FROM sap_orct h
 WHERE h.canceled = 'N'
UNION ALL
SELECT 'JDT1', j.shortname, j.refdate, j.transid,
       CASE WHEN COALESCE(j.memo, '') ~ '(기초잔액|상계|조정|대손|입금처 변경)' THEN '채권조정' ELSE '입금' END,
       j.memo, j.net, NULL
  FROM (
    SELECT shortname, transid, min(refdate) AS refdate, sum(credit - debit) AS net,
           (array_agg(linememo ORDER BY line_id))[1] AS memo
      FROM sap_jdt1
     WHERE transtype = '30'
     GROUP BY shortname, transid
    HAVING sum(credit - debit) <> 0
  ) j;

-- 거래원장: 입금/채권조정 부분만 rpt_payment로 교체 (그 외 027과 동일)
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
  SELECT h.docdate AS txdate, 1 AS grp, h.docnum, l.linenum AS sub,
         CASE WHEN h.doctotal < 0 THEN '반품' ELSE '납품' END AS gubun,
         l.dscription AS descr, l.quantity AS qty,
         CASE WHEN h.doctotal < 0 THEN 0 ELSE l.linetotal + COALESCE(l.vatsum, 0) END AS occur,
         CASE WHEN h.doctotal < 0 THEN -(l.linetotal + COALESCE(l.vatsum, 0)) ELSE 0 END AS cancel,
         0::numeric AS collect, h.comments AS remark, 'ODLN'::text AS source
    FROM sap_odln h
    JOIN sap_dln1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled = 'N' AND h.docdate <= p_end
  UNION ALL
  SELECT h.docdate, 1, h.docnum, l.linenum, '매출', l.dscription, l.quantity,
         l.linetotal + COALESCE(l.vatsum, 0), 0, 0, h.comments, 'OINV'
    FROM sap_oinv h
    JOIN sap_inv1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled IN ('N', 'Y') AND h.docdate <= p_end
     AND COALESCE(l.basetype, -1) <> 15
  UNION ALL
  SELECT h.docdate, 1, h.docnum, l.linenum, '반품', l.dscription, -l.quantity,
         0, l.linetotal + COALESCE(l.vatsum, 0), 0, h.comments, 'ORDN'
    FROM sap_ordn h
    JOIN sap_rdn1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled = 'N' AND h.docdate <= p_end
  UNION ALL
  SELECT h.docdate, 1, h.docnum, l.linenum, '대변메모', l.dscription, -l.quantity,
         0, l.linetotal + COALESCE(l.vatsum, 0), 0, h.comments, 'ORIN'
    FROM sap_orin h
    JOIN sap_rin1 l ON l.docentry = h.docentry
   WHERE h.cardcode = p_cardcode AND h.canceled IN ('N', 'Y') AND h.docdate <= p_end
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

REVOKE ALL ON public.rpt_payment FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_payment TO service_role;

NOTIFY pgrst, 'reload schema';
