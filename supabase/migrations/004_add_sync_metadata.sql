-- 동기화 메타데이터: 엔티티별 마지막 동기화 시각 및 건수
CREATE TABLE IF NOT EXISTS public.sync_metadata (
  entity_type   TEXT NOT NULL PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count  INTEGER NOT NULL DEFAULT 0,
  total_count    INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON public.sync_metadata FOR ALL USING (true) WITH CHECK (true);
