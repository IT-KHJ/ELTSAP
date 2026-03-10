-- 매일 자동 동기화 결과: 날짜별 증분 처리 건수
CREATE TABLE IF NOT EXISTS public.daily_auto_sync_results (
  sync_date     DATE NOT NULL PRIMARY KEY,
  customer_count   INTEGER NOT NULL DEFAULT 0,
  itemlist_count   INTEGER NOT NULL DEFAULT 0,
  inamt_count      INTEGER NOT NULL DEFAULT 0,
  saleetc_count    INTEGER NOT NULL DEFAULT 0,
  sales_count      INTEGER NOT NULL DEFAULT 0,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed'))
);

ALTER TABLE public.daily_auto_sync_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON public.daily_auto_sync_results FOR ALL USING (true) WITH CHECK (true);
