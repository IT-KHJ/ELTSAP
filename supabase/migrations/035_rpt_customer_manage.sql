-- 거래처 관리 화면(/internal/customers)을 SAP 거래처 기준으로 (6단계, 2026-10-28 사용자 결정)
--   목록 = SAP 거래처 마스터(ELT 미러 대상) — 기존 동기화 없이도 새 거래처가 바로 나타남
--   거래처명/주소/전화/담당자/대표자 = SAP 값 표시 전용, 사용여부/시도/시군만 앱(customer 테이블)에서 관리
--   사용여부 미입력(customer 행 없음)은 'Y' — 기존 동기화가 새 거래처를 customer 기본값 'Y'로 넣던 것과 동일
CREATE OR REPLACE VIEW public.rpt_customer
WITH (security_invoker = true) AS
SELECT o.cardcode, o.cardname, o.aliasname, COALESCE(c.useyn, 'Y') AS useyn, c.sido, c.sigun,
       o.address, o.phone1, o.phone2, o.cntctprsn, o.repname
  FROM sap_ocrd o
  JOIN sap_mirror_customers m ON m.cardcode = o.cardcode AND m.elt
  LEFT JOIN public.customer c ON c.cardcode = o.cardcode;

NOTIFY pgrst, 'reload schema';
