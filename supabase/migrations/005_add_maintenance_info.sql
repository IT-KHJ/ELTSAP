-- 점검 정보: 점검 내용 및 점검 시간 (null 허용)
CREATE TABLE IF NOT EXISTS public.maintenance_info (
  id            TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  content       TEXT,
  time_from     TIMESTAMPTZ,
  time_to       TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON public.maintenance_info FOR ALL USING (true) WITH CHECK (true);
