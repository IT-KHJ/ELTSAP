-- 설정 화면(/internal/sync) SAP 미러 상태 표시용: 대사 결과 중 SAP와 미러가 다른 월만 (6단계, 2026-10-28)
CREATE OR REPLACE VIEW public.sap_mirror_recon_mismatch
WITH (security_invoker = true) AS
SELECT table_name, ym, sap_rows, mirror_rows, sap_sum, mirror_sum, checked_at
  FROM public.sap_mirror_recon
 WHERE sap_rows IS DISTINCT FROM mirror_rows OR sap_sum IS DISTINCT FROM mirror_sum;

REVOKE ALL ON public.sap_mirror_recon_mismatch FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sap_mirror_recon_mismatch TO service_role;

NOTIFY pgrst, 'reload schema';
