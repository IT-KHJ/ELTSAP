-- 일별 이력에 판매(orders) 동기화 반영 건수 (매시간 동기화 시 갱신)
ALTER TABLE public.daily_auto_sync_results
  ADD COLUMN IF NOT EXISTS orders_count INTEGER NOT NULL DEFAULT 0;
