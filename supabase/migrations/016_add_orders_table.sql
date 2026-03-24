-- 거래처 현황(판매기준)·(판매집계)용 DLN1 동기화 테이블
-- SAP DLN1+ODLN (ocrcode='24021') 기반. docentry+linenum 복합 PK.

CREATE TABLE IF NOT EXISTS public.orders (
  docentry     INTEGER NOT NULL,
  linenum      INTEGER NOT NULL DEFAULT 0,
  docdate      TIMESTAMPTZ,
  basecard     TEXT,
  cardname     TEXT,
  aliasname    TEXT,
  itemcode     TEXT,
  itemname     TEXT,
  price        NUMERIC(19, 6),
  supply_rate  SMALLINT,
  discount_rate SMALLINT,
  quantity     NUMERIC(19, 6),
  totalsumsy   NUMERIC(19, 6),
  vatamt       NUMERIC(19, 6),
  returnamt    NUMERIC(19, 6),
  CONSTRAINT pk_orders PRIMARY KEY (docentry, linenum)
);

CREATE INDEX IF NOT EXISTS idx_orders_basecard ON public.orders (basecard);
CREATE INDEX IF NOT EXISTS idx_orders_docdate ON public.orders (docdate);
CREATE INDEX IF NOT EXISTS idx_orders_itemcode ON public.orders (itemcode);
CREATE INDEX IF NOT EXISTS idx_orders_basecard_docdate ON public.orders (basecard, docdate);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON public.orders FOR ALL USING (true) WITH CHECK (true);
