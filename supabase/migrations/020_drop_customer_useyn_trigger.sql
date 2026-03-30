-- useyn 보존 트리거 제거
-- SAP sync에서 useyn을 upsert 페이로드에 포함하지 않는 방식으로 대체되어 트리거 불필요
DROP TRIGGER IF EXISTS trg_preserve_customer_useyn ON public."CUSTOMER";
DROP FUNCTION IF EXISTS preserve_customer_useyn();
