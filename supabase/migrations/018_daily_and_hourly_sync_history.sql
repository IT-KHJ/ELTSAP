-- 일괄 동기화: completed_at 없을 수 있음(주문 전용 레거시 제거 대비). 판매 완료 시각(선택).
ALTER TABLE public.daily_auto_sync_results
  ALTER COLUMN completed_at DROP NOT NULL;

ALTER TABLE public.daily_auto_sync_results
  ADD COLUMN IF NOT EXISTS orders_completed_at TIMESTAMPTZ;

-- 매시간 cron(입금·기타출고·매출·판매) 수행 이력
CREATE TABLE IF NOT EXISTS public.hourly_sync_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  inamt_count integer NOT NULL DEFAULT 0,
  saleetc_count integer NOT NULL DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS hourly_sync_results_completed_at_idx
  ON public.hourly_sync_results (completed_at DESC);

ALTER TABLE public.hourly_sync_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service hourly_sync" ON public.hourly_sync_results FOR ALL USING (true) WITH CHECK (true);
