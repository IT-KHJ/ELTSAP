-- ====== Supabase DDL (PostgreSQL) ======
-- SAP 원본은 수정하지 않음. 동기화 시 2024-01-01 이후 데이터만 반영.

-- 1. 거래처 (CUSTOMER)
CREATE TABLE IF NOT EXISTS public."CUSTOMER" (
  "cardcode"   TEXT NOT NULL,
  "cardname"   TEXT,
  "groupcode"  SMALLINT,
  "address"    TEXT,
  "zipcode"   TEXT,
  "phone1"     TEXT,
  "phone2"     TEXT,
  "fax"        TEXT,
  "cntctprsn"  TEXT,
  "notes"      TEXT,
  "e_mail"     TEXT,
  "shiptodef"  TEXT,
  "vatregnum"  TEXT,
  "repname"    TEXT,
  "aliasname"  TEXT,
  "billtodef"  TEXT,
  "u_delyn"    TEXT,
  CONSTRAINT pk_CUSTOMER PRIMARY KEY ("cardcode")
);

CREATE INDEX IF NOT EXISTS idx_CUSTOMER_cardname ON public."CUSTOMER" ("cardname");

-- 2. 품목 (ITEMLIST)
CREATE TABLE IF NOT EXISTS public."ITEMLIST" (
  "itemcode"    TEXT NOT NULL,
  "itemname"    TEXT,
  "itmsgrpcod"  SMALLINT,
  "codebars"    TEXT,
  CONSTRAINT pk_ITEMLIST PRIMARY KEY ("itemcode")
);

CREATE INDEX IF NOT EXISTS idx_ITEMLIST_itemname ON public."ITEMLIST" ("itemname");
CREATE INDEX IF NOT EXISTS idx_ITEMLIST_itmsgrpcod ON public."ITEMLIST" ("itmsgrpcod");

-- 3. 매출 (SALES) - INV1 라인별, docentry+linenum 복합키
CREATE TABLE IF NOT EXISTS public."SALES" (
  "id"          BIGSERIAL PRIMARY KEY,
  "docentry"    INTEGER NOT NULL,
  "linenum"     INTEGER NOT NULL DEFAULT 0,
  "itemcode"    TEXT,
  "quantity"    NUMERIC(19, 6),
  "price"       NUMERIC(19, 6),
  "discprcnt"   NUMERIC(19, 6),
  "pricebefdi"  NUMERIC(19, 6),
  "docdate"     TIMESTAMPTZ,
  "basecard"    TEXT,
  "totalsumsy"  NUMERIC(19, 6),
  CONSTRAINT uq_SALES_docentry_linenum UNIQUE ("docentry", "linenum")
);

CREATE INDEX IF NOT EXISTS idx_SALES_basecard ON public."SALES" ("basecard");
CREATE INDEX IF NOT EXISTS idx_SALES_docdate ON public."SALES" ("docdate");
CREATE INDEX IF NOT EXISTS idx_SALES_itemcode ON public."SALES" ("itemcode");
CREATE INDEX IF NOT EXISTS idx_sales_basecard_docdate ON public."SALES" ("basecard", "docdate");

-- 4. 입금 (INAMT)
CREATE TABLE IF NOT EXISTS public."INAMT" (
  "docentry"   INTEGER NOT NULL,
  "docdate"    TIMESTAMPTZ,
  "cardcode"   TEXT,
  "doctotal"   NUMERIC(19, 6),
  CONSTRAINT pk_INAMT PRIMARY KEY ("docentry")
);

CREATE INDEX IF NOT EXISTS idx_INAMT_cardcode ON public."INAMT" ("cardcode");
CREATE INDEX IF NOT EXISTS idx_INAMT_docdate ON public."INAMT" ("docdate");
CREATE INDEX IF NOT EXISTS idx_inamt_cardcode_docdate ON public."INAMT" ("cardcode", "docdate");

-- 5. 기타출고 (SALEETC) - IGE1 라인별
CREATE TABLE IF NOT EXISTS public."SALEETC" (
  "id"         BIGSERIAL PRIMARY KEY,
  "docentry"   INTEGER NOT NULL,
  "linenum"    INTEGER NOT NULL DEFAULT 0,
  "itemcode"   TEXT,
  "quantity"   NUMERIC(19, 6),
  "docdate"    TIMESTAMPTZ,
  "basecard"   TEXT,
  CONSTRAINT uq_SALEETC_docentry_linenum UNIQUE ("docentry", "linenum")
);

CREATE INDEX IF NOT EXISTS idx_SALEETC_basecard ON public."SALEETC" ("basecard");
CREATE INDEX IF NOT EXISTS idx_SALEETC_docdate ON public."SALEETC" ("docdate");
CREATE INDEX IF NOT EXISTS idx_SALEETC_itemcode ON public."SALEETC" ("itemcode");
CREATE INDEX IF NOT EXISTS idx_saleetc_basecard_docdate ON public."SALEETC" ("basecard", "docdate");

-- RLS (선택): 서비스 역할로 API 사용 시 비활성화 가능
ALTER TABLE public."CUSTOMER" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ITEMLIST" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SALES" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."INAMT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SALEETC" ENABLE ROW LEVEL SECURITY;

-- 정책: anon/service 역할에서 모든 행 읽기/쓰기 허용 (실제로는 서비스 키로만 쓰도록 권장)
CREATE POLICY "Allow all for service" ON public."CUSTOMER" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public."ITEMLIST" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public."SALES" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public."INAMT" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service" ON public."SALEETC" FOR ALL USING (true) WITH CHECK (true);
