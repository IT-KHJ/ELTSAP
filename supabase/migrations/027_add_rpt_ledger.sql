-- 거래처 거래원장 (리포트 계층: SAP 원본 미러 sap_* 테이블 기반, 기존 동기화 테이블과 독립)
-- 잔액 기준: 납품 시점 발생(기존 거래원장 엑셀과 동일). 채권잔액 = 전기이월 + 발생액 - 취소액 - 회수액
-- 행 구성(B안, 2026-10-27 결정): 납품 라인은 모두 표시하고 반품 문서/대변메모를 별도 행으로 표시
--   납품/반품   : 납품 문서(ODLN/DLN1), 문서 합계가 음수면 '반품'. 금액 = 부가세 포함(LineTotal + VatSum)
--   반품        : 반품 문서(ORDN/RDN1)
--   매출        : 납품 없이 발행된 AR 송장 라인(OINV/INV1, BaseType<>15). 납품 기반 송장 라인은 납품 시점에 이미 발생 처리되므로 제외
--                 canceled 'N','Y' 포함('Y' 송장은 대응하는 'Y' 대변메모와 상쇄). 2026-10-27 ELT 183곳 9/30 잔액 검증:
--                 SAP 채권(JDT1) 일치 145곳 → 161곳, 기존 일치 거래처 영향 0 (나머지는 미청구 납품 등 납품 기준 차이)
--   대변메모    : AR 대변메모(ORIN/RIN1). canceled='Y'는 이 SAP 버전에서 '송장 취소 문서'(채권 감소 유효)이므로 포함
--   입금        : 입금(ORCT)
--   입금/채권조정: 거래처 계정 수동 분개(JDT1 TransType 30) 분개별 순액, 차대 상쇄(0) 분개 제외.
--                 메모에 기초잔액/상계/조정/대손/입금처 변경 포함 시 '채권조정', 그 외 '입금' (C001201 엑셀 기준 검증)
-- 정렬: 거래일자 → 납품·반품·대변메모 → 입금·조정, 같은 그룹은 문서번호·라인 순

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
-- 거래처 1곳의 문서만 읽도록 중첩 루프 조인 고정: 해시 조인은 전체 거래처 라인 인덱스를 훑어
-- 데이터가 늘수록 느려짐 (C001201 기준 25초 → 4초, 적재 부하 중 측정)
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
  SELECT h.docdate, 2, NULL, h.docentry, '입금', h.jrnlmemo, NULL,
         0, 0, h.doctotal, h.comments, 'ORCT'
    FROM sap_orct h
   WHERE h.cardcode = p_cardcode AND h.canceled = 'N' AND h.docdate <= p_end
  UNION ALL
  SELECT j.refdate, 2, NULL, j.transid,
         CASE WHEN COALESCE(j.memo, '') ~ '(기초잔액|상계|조정|대손|입금처 변경)' THEN '채권조정' ELSE '입금' END,
         j.memo, NULL, 0, 0, j.net, NULL, 'JDT1'
    FROM (
      SELECT transid, min(refdate) AS refdate, sum(credit - debit) AS net,
             (array_agg(linememo ORDER BY line_id))[1] AS memo
        FROM sap_jdt1
       WHERE shortname = p_cardcode AND transtype = '30' AND refdate <= p_end
       GROUP BY transid
      HAVING sum(credit - debit) <> 0
    ) j
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

-- API용: 결과 전체를 JSON 배열 1행으로 반환 (Supabase API 1,000행 제한 때문에 나눠 호출하면 원장을 매번 재계산하게 되므로)
CREATE OR REPLACE FUNCTION public.rpt_ledger_json(p_cardcode text, p_start date, p_end date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.seq), '[]'::jsonb)
    FROM public.rpt_ledger(p_cardcode, p_start, p_end) t;
$fn$;

REVOKE ALL ON FUNCTION public.rpt_ledger(text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_ledger(text, date, date) TO service_role;
REVOKE ALL ON FUNCTION public.rpt_ledger_json(text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpt_ledger_json(text, date, date) TO service_role;

-- 메뉴: 거래처 매출 대시보드(40) 바로 아래
INSERT INTO public.menus (id, path, label, sort_order)
VALUES ('ledger', '/internal/ledger', '거래처 거래원장', 45)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
