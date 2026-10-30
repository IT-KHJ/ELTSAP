-- 입금/채권조정에 SAP '수동 조정 트랜잭션'(JDT1 TransType 321) 추가 (2026-10-30 사용자 결정)
-- 9/30 잔액이 SAP 채권과 다르던 22곳 중 8곳의 원인: 거래처 간 잔액 이동·상계 분개(2013~2020년)가 규칙에 없었음.
-- 규칙은 TransType 30과 동일(분개별 순액, 차대 상쇄(0) 분개 제외), 구분은 항상 '채권조정'.
-- 거래처 현황(마감기준)은 gubun='입금'만 쓰므로 영향 없음.

CREATE OR REPLACE VIEW public.rpt_payment
WITH (security_invoker = true) AS
SELECT 'ORCT'::text AS source, h.cardcode, h.docdate AS txdate, h.docentry AS sub,
       '입금'::text AS gubun, h.jrnlmemo AS descr, h.doctotal AS amount, h.comments AS remark
  FROM sap_orct h
 WHERE h.canceled = 'N'
UNION ALL
SELECT 'JDT1', j.shortname, j.refdate, j.transid,
       CASE WHEN j.transtype = '321' THEN '채권조정'
            WHEN COALESCE(j.memo, '') ~ '(기초잔액|상계|조정|대손|입금처 변경)' THEN '채권조정' ELSE '입금' END,
       j.memo, j.net, NULL
  FROM (
    SELECT shortname, transid, min(transtype) AS transtype, min(refdate) AS refdate, sum(credit - debit) AS net,
           (array_agg(linememo ORDER BY line_id))[1] AS memo
      FROM sap_jdt1
     WHERE transtype IN ('30', '321')
     GROUP BY shortname, transid
    HAVING sum(credit - debit) <> 0
  ) j;

REVOKE ALL ON public.rpt_payment FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rpt_payment TO service_role;

NOTIFY pgrst, 'reload schema';
