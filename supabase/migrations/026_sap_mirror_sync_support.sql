-- SAP 원본 미러 계층 DDL (scripts/sap-mirror/generate-ddl.ts로 자동 생성 — 직접 수정하지 말 것)
-- 기준: scripts/sap-mirror/schema.json (version 1)
-- 원칙: SAP 값을 변환 없이 보관(컬럼명은 소문자), 업무 규칙은 리포트 함수에서 적용. 기존 테이블/동기화와 독립.
-- 범위: 문서는 ELT 거래처(GroupCode IN (100,104) AND U_COSTCD = '24021') 기준, 마스터는 전체. 개인정보 컬럼은 제외.
-- 멱등: 여러 번 실행해도 안전하며, 명세에 새로 추가된 테이블/컬럼/인덱스만 반영된다.

-- ORDR: 판매오더 헤더 (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_ordr (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ordr PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_ordr
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_ordr_cardcode_docdate ON public.sap_ordr ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_ordr_updatedate ON public.sap_ordr ("updatedate");
COMMENT ON TABLE public.sap_ordr IS 'SAP ORDR 원본 미러: 판매오더 헤더';
COMMENT ON COLUMN public.sap_ordr."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_ordr."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_ordr."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_ordr."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_ordr."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_ordr."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_ordr."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_ordr."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_ordr."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_ordr."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_ordr."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_ordr."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_ordr."u_distnum" IS '채번';
ALTER TABLE public.sap_ordr ENABLE ROW LEVEL SECURITY;

-- ODLN: 납품 헤더 (반품도 음수 납품으로 입력됨) (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_odln (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_odln PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_odln
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_odln_cardcode_docdate ON public.sap_odln ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_odln_updatedate ON public.sap_odln ("updatedate");
COMMENT ON TABLE public.sap_odln IS 'SAP ODLN 원본 미러: 납품 헤더 (반품도 음수 납품으로 입력됨)';
COMMENT ON COLUMN public.sap_odln."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_odln."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_odln."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_odln."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_odln."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_odln."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_odln."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_odln."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_odln."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_odln."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_odln."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_odln."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_odln."u_distnum" IS '채번';
ALTER TABLE public.sap_odln ENABLE ROW LEVEL SECURITY;

-- ORDN: 반품 헤더 (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_ordn (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ordn PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_ordn
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_ordn_cardcode_docdate ON public.sap_ordn ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_ordn_updatedate ON public.sap_ordn ("updatedate");
COMMENT ON TABLE public.sap_ordn IS 'SAP ORDN 원본 미러: 반품 헤더';
COMMENT ON COLUMN public.sap_ordn."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_ordn."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_ordn."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_ordn."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_ordn."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_ordn."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_ordn."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_ordn."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_ordn."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_ordn."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_ordn."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_ordn."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_ordn."u_distnum" IS '채번';
ALTER TABLE public.sap_ordn ENABLE ROW LEVEL SECURITY;

-- OINV: AR 송장 헤더 (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_oinv (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oinv PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_oinv
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_oinv_cardcode_docdate ON public.sap_oinv ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_oinv_updatedate ON public.sap_oinv ("updatedate");
COMMENT ON TABLE public.sap_oinv IS 'SAP OINV 원본 미러: AR 송장 헤더';
COMMENT ON COLUMN public.sap_oinv."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_oinv."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_oinv."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_oinv."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_oinv."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_oinv."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_oinv."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_oinv."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_oinv."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_oinv."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_oinv."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_oinv."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_oinv."u_distnum" IS '채번';
ALTER TABLE public.sap_oinv ENABLE ROW LEVEL SECURITY;

-- ORIN: AR 대변메모 헤더 (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_orin (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_orin PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_orin
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_orin_cardcode_docdate ON public.sap_orin ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_orin_updatedate ON public.sap_orin ("updatedate");
COMMENT ON TABLE public.sap_orin IS 'SAP ORIN 원본 미러: AR 대변메모 헤더';
COMMENT ON COLUMN public.sap_orin."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_orin."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_orin."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_orin."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_orin."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_orin."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_orin."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_orin."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_orin."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_orin."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_orin."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_orin."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_orin."u_distnum" IS '채번';
ALTER TABLE public.sap_orin ENABLE ROW LEVEL SECURITY;

-- OIGE: 출고(기타출고) 헤더 (범위: header_elt, 컬럼 92개)
CREATE TABLE IF NOT EXISTS public.sap_oige (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oige PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_oige
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "doctype" text,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docstatus" text,
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "numatcard" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidtodate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "importent" integer,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "discsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grosprofsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "stampnum" text,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "vatpaid" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatpaidsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "address2" text,
  ADD COLUMN IF NOT EXISTS "stationid" integer,
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "reqdate" date,
  ADD COLUMN IF NOT EXISTS "canceldate" date,
  ADD COLUMN IF NOT EXISTS "peymethod" text,
  ADD COLUMN IF NOT EXISTS "max1099" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pickrmrk" text,
  ADD COLUMN IF NOT EXISTS "letternum" text,
  ADD COLUMN IF NOT EXISTS "ceecflag" text,
  ADD COLUMN IF NOT EXISTS "paidsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paidsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "header" text,
  ADD COLUMN IF NOT EXISTS "footer" text,
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "bpnameow" text,
  ADD COLUMN IF NOT EXISTS "shiptoow" text,
  ADD COLUMN IF NOT EXISTS "lndcstnum" integer,
  ADD COLUMN IF NOT EXISTS "pqtgrpnum" integer,
  ADD COLUMN IF NOT EXISTS "reoporidoc" text,
  ADD COLUMN IF NOT EXISTS "reopmancls" text,
  ADD COLUMN IF NOT EXISTS "docmanclsd" text,
  ADD COLUMN IF NOT EXISTS "paydumonth" text,
  ADD COLUMN IF NOT EXISTS "extramonth" smallint,
  ADD COLUMN IF NOT EXISTS "extradays" smallint,
  ADD COLUMN IF NOT EXISTS "basediscpr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "createts" integer,
  ADD COLUMN IF NOT EXISTS "updatets" integer,
  ADD COLUMN IF NOT EXISTS "paiddpm" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpmf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "paiddpms" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_trpymt" text,
  ADD COLUMN IF NOT EXISTS "u_inctrm" text,
  ADD COLUMN IF NOT EXISTS "u_ofgbn" text,
  ADD COLUMN IF NOT EXISTS "u_permg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_prtyn" text,
  ADD COLUMN IF NOT EXISTS "u_canyn" text,
  ADD COLUMN IF NOT EXISTS "u_transtype" text,
  ADD COLUMN IF NOT EXISTS "u_bpcode" text,
  ADD COLUMN IF NOT EXISTS "u_booktp" text,
  ADD COLUMN IF NOT EXISTS "u_aprrmk" text,
  ADD COLUMN IF NOT EXISTS "u_salegbn" text,
  ADD COLUMN IF NOT EXISTS "u_distnum" text;
CREATE INDEX IF NOT EXISTS idx_sap_oige_cardcode_docdate ON public.sap_oige ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_oige_updatedate ON public.sap_oige ("updatedate");
COMMENT ON TABLE public.sap_oige IS 'SAP OIGE 원본 미러: 출고(기타출고) 헤더';
COMMENT ON COLUMN public.sap_oige."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_oige."u_trpymt" IS '결제방법';
COMMENT ON COLUMN public.sap_oige."u_inctrm" IS '거래조건';
COMMENT ON COLUMN public.sap_oige."u_ofgbn" IS '주문유형';
COMMENT ON COLUMN public.sap_oige."u_permg" IS '사용적립금';
COMMENT ON COLUMN public.sap_oige."u_prtyn" IS '출고지시인쇄';
COMMENT ON COLUMN public.sap_oige."u_canyn" IS '취소여부';
COMMENT ON COLUMN public.sap_oige."u_transtype" IS '거래유형';
COMMENT ON COLUMN public.sap_oige."u_bpcode" IS '거래처';
COMMENT ON COLUMN public.sap_oige."u_booktp" IS 'CP사교재구분';
COMMENT ON COLUMN public.sap_oige."u_aprrmk" IS '관리자비고';
COMMENT ON COLUMN public.sap_oige."u_salegbn" IS '계산서판매구분';
COMMENT ON COLUMN public.sap_oige."u_distnum" IS '채번';
ALTER TABLE public.sap_oige ENABLE ROW LEVEL SECURITY;

-- RDR1: 판매오더 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_rdr1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_rdr1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_rdr1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_rdr1_basecard_docdate ON public.sap_rdr1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_rdr1_itemcode ON public.sap_rdr1 ("itemcode");
COMMENT ON TABLE public.sap_rdr1 IS 'SAP RDR1 원본 미러: 판매오더 라인';
COMMENT ON COLUMN public.sap_rdr1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_rdr1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_rdr1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_rdr1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_rdr1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_rdr1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_rdr1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_rdr1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_rdr1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_rdr1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_rdr1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_rdr1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_rdr1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_rdr1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_rdr1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_rdr1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_rdr1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_rdr1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_rdr1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_rdr1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_rdr1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_rdr1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_rdr1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_rdr1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_rdr1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_rdr1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_rdr1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_rdr1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_rdr1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_rdr1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_rdr1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_rdr1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_rdr1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_rdr1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_rdr1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_rdr1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_rdr1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_rdr1 ENABLE ROW LEVEL SECURITY;

-- DLN1: 납품 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_dln1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_dln1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_dln1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_dln1_basecard_docdate ON public.sap_dln1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_dln1_itemcode ON public.sap_dln1 ("itemcode");
COMMENT ON TABLE public.sap_dln1 IS 'SAP DLN1 원본 미러: 납품 라인';
COMMENT ON COLUMN public.sap_dln1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_dln1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_dln1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_dln1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_dln1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_dln1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_dln1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_dln1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_dln1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_dln1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_dln1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_dln1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_dln1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_dln1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_dln1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_dln1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_dln1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_dln1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_dln1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_dln1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_dln1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_dln1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_dln1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_dln1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_dln1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_dln1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_dln1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_dln1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_dln1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_dln1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_dln1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_dln1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_dln1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_dln1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_dln1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_dln1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_dln1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_dln1 ENABLE ROW LEVEL SECURITY;

-- RDN1: 반품 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_rdn1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_rdn1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_rdn1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_rdn1_basecard_docdate ON public.sap_rdn1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_rdn1_itemcode ON public.sap_rdn1 ("itemcode");
COMMENT ON TABLE public.sap_rdn1 IS 'SAP RDN1 원본 미러: 반품 라인';
COMMENT ON COLUMN public.sap_rdn1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_rdn1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_rdn1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_rdn1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_rdn1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_rdn1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_rdn1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_rdn1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_rdn1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_rdn1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_rdn1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_rdn1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_rdn1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_rdn1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_rdn1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_rdn1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_rdn1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_rdn1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_rdn1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_rdn1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_rdn1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_rdn1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_rdn1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_rdn1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_rdn1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_rdn1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_rdn1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_rdn1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_rdn1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_rdn1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_rdn1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_rdn1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_rdn1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_rdn1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_rdn1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_rdn1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_rdn1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_rdn1 ENABLE ROW LEVEL SECURITY;

-- INV1: AR 송장 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_inv1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_inv1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_inv1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_inv1_basecard_docdate ON public.sap_inv1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_inv1_itemcode ON public.sap_inv1 ("itemcode");
COMMENT ON TABLE public.sap_inv1 IS 'SAP INV1 원본 미러: AR 송장 라인';
COMMENT ON COLUMN public.sap_inv1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_inv1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_inv1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_inv1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_inv1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_inv1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_inv1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_inv1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_inv1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_inv1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_inv1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_inv1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_inv1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_inv1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_inv1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_inv1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_inv1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_inv1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_inv1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_inv1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_inv1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_inv1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_inv1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_inv1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_inv1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_inv1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_inv1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_inv1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_inv1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_inv1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_inv1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_inv1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_inv1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_inv1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_inv1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_inv1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_inv1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_inv1 ENABLE ROW LEVEL SECURITY;

-- RIN1: AR 대변메모 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_rin1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_rin1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_rin1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_rin1_basecard_docdate ON public.sap_rin1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_rin1_itemcode ON public.sap_rin1 ("itemcode");
COMMENT ON TABLE public.sap_rin1 IS 'SAP RIN1 원본 미러: AR 대변메모 라인';
COMMENT ON COLUMN public.sap_rin1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_rin1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_rin1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_rin1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_rin1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_rin1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_rin1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_rin1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_rin1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_rin1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_rin1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_rin1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_rin1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_rin1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_rin1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_rin1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_rin1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_rin1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_rin1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_rin1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_rin1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_rin1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_rin1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_rin1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_rin1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_rin1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_rin1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_rin1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_rin1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_rin1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_rin1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_rin1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_rin1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_rin1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_rin1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_rin1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_rin1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_rin1 ENABLE ROW LEVEL SECURITY;

-- IGE1: 출고(기타출고) 라인 (범위: lines_of_header, 컬럼 145개)
CREATE TABLE IF NOT EXISTS public.sap_ige1 (
  "docentry" integer NOT NULL,
  "linenum" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ige1 PRIMARY KEY ("docentry", "linenum")
);
ALTER TABLE public.sap_ige1
  ADD COLUMN IF NOT EXISTS "targettype" integer,
  ADD COLUMN IF NOT EXISTS "trgetentry" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "basetype" integer,
  ADD COLUMN IF NOT EXISTS "baseentry" integer,
  ADD COLUMN IF NOT EXISTS "baseline" integer,
  ADD COLUMN IF NOT EXISTS "linestatus" text,
  ADD COLUMN IF NOT EXISTS "itemcode" text,
  ADD COLUMN IF NOT EXISTS "dscription" text,
  ADD COLUMN IF NOT EXISTS "quantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shipdate" date,
  ADD COLUMN IF NOT EXISTS "openqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "discprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vendornum" text,
  ADD COLUMN IF NOT EXISTS "serialnum" text,
  ADD COLUMN IF NOT EXISTS "whscode" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "acctcode" text,
  ADD COLUMN IF NOT EXISTS "grossbuypr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pricebefdi" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "flags" integer,
  ADD COLUMN IF NOT EXISTS "opencreqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usebaseun" text,
  ADD COLUMN IF NOT EXISTS "subcatnum" text,
  ADD COLUMN IF NOT EXISTS "basecard" text,
  ADD COLUMN IF NOT EXISTS "totalsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "opensumsys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "invntsttus" text,
  ADD COLUMN IF NOT EXISTS "ocrcode" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "vatprcnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatgroup" text,
  ADD COLUMN IF NOT EXISTS "priceafvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "volunit" smallint,
  ADD COLUMN IF NOT EXISTS "factor1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "factor4" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "packqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basedocnum" integer,
  ADD COLUMN IF NOT EXISTS "baseatcard" text,
  ADD COLUMN IF NOT EXISTS "sww" text,
  ADD COLUMN IF NOT EXISTS "vatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "objtype" text,
  ADD COLUMN IF NOT EXISTS "dedvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dedvatsums" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grssprofsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "visorder" integer,
  ADD COLUMN IF NOT EXISTS "inmprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "potrgentry" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "taxtype" text,
  ADD COLUMN IF NOT EXISTS "origitem" text,
  ADD COLUMN IF NOT EXISTS "backordr" text,
  ADD COLUMN IF NOT EXISTS "freetxt" text,
  ADD COLUMN IF NOT EXISTS "baseqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseopnqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linevats" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr" text,
  ADD COLUMN IF NOT EXISTS "numpermsr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ownercode" integer,
  ADD COLUMN IF NOT EXISTS "stockprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "consumefct" text,
  ADD COLUMN IF NOT EXISTS "stocksum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "stocksumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shiptocode" text,
  ADD COLUMN IF NOT EXISTS "shiptodesc" text,
  ADD COLUMN IF NOT EXISTS "gtotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gtotalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "distribexp" text,
  ADD COLUMN IF NOT EXISTS "descow" text,
  ADD COLUMN IF NOT EXISTS "grossbase" smallint,
  ADD COLUMN IF NOT EXISTS "taxonly" text,
  ADD COLUMN IF NOT EXISTS "wtcalced" text,
  ADD COLUMN IF NOT EXISTS "qtytoship" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "delivrdqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderedqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrcod" text,
  ADD COLUMN IF NOT EXISTS "cogsacct" text,
  ADD COLUMN IF NOT EXISTS "chgasmbomw" text,
  ADD COLUMN IF NOT EXISTS "actdeldate" date,
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "assblvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cogsocrco2" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "gpttlbaspr" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "unitmsr2" text,
  ADD COLUMN IF NOT EXISTS "numpermsr2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "specprice" text,
  ADD COLUMN IF NOT EXISTS "pqtreqqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "pcquantity" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linmanclsd" text,
  ADD COLUMN IF NOT EXISTS "vatgrpsrc" text,
  ADD COLUMN IF NOT EXISTS "surpluses" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "defbreak" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "shortages" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_stdamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_bdocnum" text,
  ADD COLUMN IF NOT EXISTS "u_blineid" integer,
  ADD COLUMN IF NOT EXISTS "u_reqsqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_sprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_dcrt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_linemg" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_grirqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_lcqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_blqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_ccqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_scrapqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_setupqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_moveqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_mamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_pqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_boxqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_rk2" text,
  ADD COLUMN IF NOT EXISTS "u_apqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_capitmp" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_srate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_custcd" text,
  ADD COLUMN IF NOT EXISTS "u_rece" text,
  ADD COLUMN IF NOT EXISTS "u_tel" text,
  ADD COLUMN IF NOT EXISTS "u_mob" text,
  ADD COLUMN IF NOT EXISTS "u_zip" text,
  ADD COLUMN IF NOT EXISTS "u_addr" text,
  ADD COLUMN IF NOT EXISTS "u_custnm" text,
  ADD COLUMN IF NOT EXISTS "u_sendtp" text,
  ADD COLUMN IF NOT EXISTS "u_docdate" text,
  ADD COLUMN IF NOT EXISTS "u_code" text,
  ADD COLUMN IF NOT EXISTS "u_seq" integer,
  ADD COLUMN IF NOT EXISTS "u_setitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_setqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_slipno" text,
  ADD COLUMN IF NOT EXISTS "u_slipseq" integer,
  ADD COLUMN IF NOT EXISTS "u_setyn" text;
CREATE INDEX IF NOT EXISTS idx_sap_ige1_basecard_docdate ON public.sap_ige1 ("basecard", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_ige1_itemcode ON public.sap_ige1 ("itemcode");
COMMENT ON TABLE public.sap_ige1 IS 'SAP IGE1 원본 미러: 출고(기타출고) 라인';
COMMENT ON COLUMN public.sap_ige1."u_stdamt" IS '표준가공비';
COMMENT ON COLUMN public.sap_ige1."u_bdocnum" IS '근거번호';
COMMENT ON COLUMN public.sap_ige1."u_blineid" IS '근거라인';
COMMENT ON COLUMN public.sap_ige1."u_reqsqty" IS '생산요청누적수량';
COMMENT ON COLUMN public.sap_ige1."u_sprc" IS '정상가';
COMMENT ON COLUMN public.sap_ige1."u_dcrt" IS '할인율';
COMMENT ON COLUMN public.sap_ige1."u_linemg" IS '사용적립금';
COMMENT ON COLUMN public.sap_ige1."u_grirqty" IS '입출고수량';
COMMENT ON COLUMN public.sap_ige1."u_lcqty" IS 'L/C 수량';
COMMENT ON COLUMN public.sap_ige1."u_blqty" IS 'B/L 수량';
COMMENT ON COLUMN public.sap_ige1."u_ccqty" IS '통관수량';
COMMENT ON COLUMN public.sap_ige1."u_scrapqty" IS 'Scrap 수량';
COMMENT ON COLUMN public.sap_ige1."u_setupqty" IS 'Setup 수량';
COMMENT ON COLUMN public.sap_ige1."u_moveqty" IS '재고이전요청수량';
COMMENT ON COLUMN public.sap_ige1."u_mamt" IS '재료비';
COMMENT ON COLUMN public.sap_ige1."u_pqty" IS '생산요청수량';
COMMENT ON COLUMN public.sap_ige1."u_boxqty" IS 'Box수량';
COMMENT ON COLUMN public.sap_ige1."u_rk2" IS '비고2';
COMMENT ON COLUMN public.sap_ige1."u_apqty" IS '외주가공비정산수량';
COMMENT ON COLUMN public.sap_ige1."u_capitmp" IS '변동임가공비단가';
COMMENT ON COLUMN public.sap_ige1."u_srate" IS '공급율';
COMMENT ON COLUMN public.sap_ige1."u_custcd" IS '개인ID';
COMMENT ON COLUMN public.sap_ige1."u_rece" IS '받는사람';
COMMENT ON COLUMN public.sap_ige1."u_tel" IS '전화번호';
COMMENT ON COLUMN public.sap_ige1."u_mob" IS '핸드폰번호';
COMMENT ON COLUMN public.sap_ige1."u_zip" IS '우편번호';
COMMENT ON COLUMN public.sap_ige1."u_addr" IS '주소';
COMMENT ON COLUMN public.sap_ige1."u_custnm" IS '개인명';
COMMENT ON COLUMN public.sap_ige1."u_sendtp" IS '배송유형';
COMMENT ON COLUMN public.sap_ige1."u_docdate" IS '전기일';
COMMENT ON COLUMN public.sap_ige1."u_code" IS '전기일키';
COMMENT ON COLUMN public.sap_ige1."u_seq" IS '순번';
COMMENT ON COLUMN public.sap_ige1."u_setitemcd" IS '세트품목코드';
COMMENT ON COLUMN public.sap_ige1."u_setqty" IS '세트수량';
COMMENT ON COLUMN public.sap_ige1."u_slipno" IS 'WEB키';
COMMENT ON COLUMN public.sap_ige1."u_slipseq" IS 'WEB라인키';
COMMENT ON COLUMN public.sap_ige1."u_setyn" IS '세트구분';
ALTER TABLE public.sap_ige1 ENABLE ROW LEVEL SECURITY;

-- ORCT: 입금 (범위: header_elt, 컬럼 32개)
CREATE TABLE IF NOT EXISTS public.sap_orct (
  "docentry" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_orct PRIMARY KEY ("docentry")
);
ALTER TABLE public.sap_orct
  ADD COLUMN IF NOT EXISTS "docnum" integer,
  ADD COLUMN IF NOT EXISTS "canceled" text,
  ADD COLUMN IF NOT EXISTS "docdate" date,
  ADD COLUMN IF NOT EXISTS "docduedate" date,
  ADD COLUMN IF NOT EXISTS "cardcode" text,
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "trsfrsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "trsfrdate" date,
  ADD COLUMN IF NOT EXISTS "nodocsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "jrnlmemo" text,
  ADD COLUMN IF NOT EXISTS "transid" integer,
  ADD COLUMN IF NOT EXISTS "doctime" smallint,
  ADD COLUMN IF NOT EXISTS "cntctcode" integer,
  ADD COLUMN IF NOT EXISTS "trsfrsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "nodocsumsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "doctotalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "paytocode" text,
  ADD COLUMN IF NOT EXISTS "versionnum" text,
  ADD COLUMN IF NOT EXISTS "openbal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "openbalsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_trdate" text,
  ADD COLUMN IF NOT EXISTS "u_trno" text,
  ADD COLUMN IF NOT EXISTS "u_vacctno" text;
CREATE INDEX IF NOT EXISTS idx_sap_orct_cardcode_docdate ON public.sap_orct ("cardcode", "docdate");
CREATE INDEX IF NOT EXISTS idx_sap_orct_updatedate ON public.sap_orct ("updatedate");
COMMENT ON TABLE public.sap_orct IS 'SAP ORCT 원본 미러: 입금';
COMMENT ON COLUMN public.sap_orct."u_trdate" IS '입금일자';
COMMENT ON COLUMN public.sap_orct."u_trno" IS '입금번호';
COMMENT ON COLUMN public.sap_orct."u_vacctno" IS '가상계좌';
ALTER TABLE public.sap_orct ENABLE ROW LEVEL SECURITY;

-- OJDT: 분개 헤더 (범위: jdt_of_elt_lines, 컬럼 44개)
CREATE TABLE IF NOT EXISTS public.sap_ojdt (
  "transid" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ojdt PRIMARY KEY ("transid")
);
ALTER TABLE public.sap_ojdt
  ADD COLUMN IF NOT EXISTS "transtype" text,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "refdate" date,
  ADD COLUMN IF NOT EXISTS "memo" text,
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "ref2" text,
  ADD COLUMN IF NOT EXISTS "createdby" integer,
  ADD COLUMN IF NOT EXISTS "loctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "systotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "transcode" text,
  ADD COLUMN IF NOT EXISTS "transrate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "transcurr" text,
  ADD COLUMN IF NOT EXISTS "project" text,
  ADD COLUMN IF NOT EXISTS "duedate" date,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "stornototr" integer,
  ADD COLUMN IF NOT EXISTS "autostorno" text,
  ADD COLUMN IF NOT EXISTS "number" integer,
  ADD COLUMN IF NOT EXISTS "docseries" smallint,
  ADD COLUMN IF NOT EXISTS "createtime" smallint,
  ADD COLUMN IF NOT EXISTS "creator" text,
  ADD COLUMN IF NOT EXISTS "approver" text,
  ADD COLUMN IF NOT EXISTS "wtsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtsumfc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtapplied" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtapplieds" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtappliedf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseamnt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseamntsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "baseamntfc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basevtat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basevtatsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "basevtatfc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ref3" text,
  ADD COLUMN IF NOT EXISTS "u_docyn" text,
  ADD COLUMN IF NOT EXISTS "u_billgbn" text;
CREATE INDEX IF NOT EXISTS idx_sap_ojdt_updatedate ON public.sap_ojdt ("updatedate");
COMMENT ON TABLE public.sap_ojdt IS 'SAP OJDT 원본 미러: 분개 헤더';
COMMENT ON COLUMN public.sap_ojdt."u_docyn" IS '정상문서';
COMMENT ON COLUMN public.sap_ojdt."u_billgbn" IS '계산서발행구분';
ALTER TABLE public.sap_ojdt ENABLE ROW LEVEL SECURITY;

-- JDT1: 분개 라인 (ELT 거래처 계정 라인만) (범위: jdt1_elt_shortname, 컬럼 81개)
CREATE TABLE IF NOT EXISTS public.sap_jdt1 (
  "transid" integer NOT NULL,
  "line_id" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_jdt1 PRIMARY KEY ("transid", "line_id")
);
ALTER TABLE public.sap_jdt1
  ADD COLUMN IF NOT EXISTS "account" text,
  ADD COLUMN IF NOT EXISTS "debit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "credit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "syscred" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "sysdeb" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "duedate" date,
  ADD COLUMN IF NOT EXISTS "sourceid" integer,
  ADD COLUMN IF NOT EXISTS "sourceline" smallint,
  ADD COLUMN IF NOT EXISTS "shortname" text,
  ADD COLUMN IF NOT EXISTS "contraact" text,
  ADD COLUMN IF NOT EXISTS "linememo" text,
  ADD COLUMN IF NOT EXISTS "ref3line" text,
  ADD COLUMN IF NOT EXISTS "transtype" text,
  ADD COLUMN IF NOT EXISTS "refdate" date,
  ADD COLUMN IF NOT EXISTS "ref1" text,
  ADD COLUMN IF NOT EXISTS "ref2" text,
  ADD COLUMN IF NOT EXISTS "createdby" integer,
  ADD COLUMN IF NOT EXISTS "baseref" text,
  ADD COLUMN IF NOT EXISTS "project" text,
  ADD COLUMN IF NOT EXISTS "transcode" text,
  ADD COLUMN IF NOT EXISTS "profitcode" text,
  ADD COLUMN IF NOT EXISTS "taxdate" date,
  ADD COLUMN IF NOT EXISTS "systemrate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "mthdate" date,
  ADD COLUMN IF NOT EXISTS "tomthsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "finncpriod" integer,
  ADD COLUMN IF NOT EXISTS "basesum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatrate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "indicator" text,
  ADD COLUMN IF NOT EXISTS "paymentref" text,
  ADD COLUMN IF NOT EXISTS "sysbasesum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "vatamount" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "sysvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grossvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "linetype" integer,
  ADD COLUMN IF NOT EXISTS "debcred" text,
  ADD COLUMN IF NOT EXISTS "balduedeb" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "balduecred" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "balscdeb" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "balsccred" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "grossvalfc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ocrcode2" text,
  ADD COLUMN IF NOT EXISTS "ocrcode3" text,
  ADD COLUMN IF NOT EXISTS "ocrcode4" text,
  ADD COLUMN IF NOT EXISTS "ocrcode5" text,
  ADD COLUMN IF NOT EXISTS "equvatrate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "equvatsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "sysequsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "totalvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "systvat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtapplied" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtapplieds" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtappliedf" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtsum" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtsumfc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "wtsumsc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "lictradnum" text,
  ADD COLUMN IF NOT EXISTS "matchref" text,
  ADD COLUMN IF NOT EXISTS "u_supamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_vat" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_soperamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extnm3" text,
  ADD COLUMN IF NOT EXISTS "u_extrmk1" text,
  ADD COLUMN IF NOT EXISTS "u_extrmk3" text,
  ADD COLUMN IF NOT EXISTS "u_extamt1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extamt2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extamt3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extqty1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extqty2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extqty3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extprc1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extprc2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extprc3" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extsum1" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_extsum2" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_excrate" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_fctotal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_duedate2" date;
CREATE INDEX IF NOT EXISTS idx_sap_jdt1_shortname_refdate ON public.sap_jdt1 ("shortname", "refdate");
COMMENT ON TABLE public.sap_jdt1 IS 'SAP JDT1 원본 미러: 분개 라인 (ELT 거래처 계정 라인만)';
COMMENT ON COLUMN public.sap_jdt1."u_supamt" IS '공급가액';
COMMENT ON COLUMN public.sap_jdt1."u_vat" IS '부가세';
COMMENT ON COLUMN public.sap_jdt1."u_soperamt" IS '상계예정금액';
COMMENT ON COLUMN public.sap_jdt1."u_extnm3" IS 'ExtraField3(Name)';
COMMENT ON COLUMN public.sap_jdt1."u_extrmk1" IS 'ExtraField1(Remark)';
COMMENT ON COLUMN public.sap_jdt1."u_extrmk3" IS 'ExtraField3(Remark)';
COMMENT ON COLUMN public.sap_jdt1."u_extamt1" IS 'ExtraField1(Amt)';
COMMENT ON COLUMN public.sap_jdt1."u_extamt2" IS 'ExtraField2(Amt)';
COMMENT ON COLUMN public.sap_jdt1."u_extamt3" IS 'ExtraField3(Amt)';
COMMENT ON COLUMN public.sap_jdt1."u_extqty1" IS 'ExtraField1(Qty)';
COMMENT ON COLUMN public.sap_jdt1."u_extqty2" IS 'ExtraField2(Qty)';
COMMENT ON COLUMN public.sap_jdt1."u_extqty3" IS 'ExtraField3(Qty)';
COMMENT ON COLUMN public.sap_jdt1."u_extprc1" IS 'ExtraField1(Price)';
COMMENT ON COLUMN public.sap_jdt1."u_extprc2" IS 'ExtraField2(Price)';
COMMENT ON COLUMN public.sap_jdt1."u_extprc3" IS 'ExtraField3(Price)';
COMMENT ON COLUMN public.sap_jdt1."u_extsum1" IS 'ExtraField1(Sum)';
COMMENT ON COLUMN public.sap_jdt1."u_extsum2" IS 'ExtraField2(Sum)';
COMMENT ON COLUMN public.sap_jdt1."u_excrate" IS '환율';
COMMENT ON COLUMN public.sap_jdt1."u_fctotal" IS '외화금액';
COMMENT ON COLUMN public.sap_jdt1."u_duedate2" IS '만기일(변경)';
ALTER TABLE public.sap_jdt1 ENABLE ROW LEVEL SECURITY;

-- OCRD: 거래처 마스터 (전체) (범위: all, 컬럼 90개)
CREATE TABLE IF NOT EXISTS public.sap_ocrd (
  "cardcode" text NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ocrd PRIMARY KEY ("cardcode")
);
ALTER TABLE public.sap_ocrd
  ADD COLUMN IF NOT EXISTS "cardname" text,
  ADD COLUMN IF NOT EXISTS "cardtype" text,
  ADD COLUMN IF NOT EXISTS "groupcode" smallint,
  ADD COLUMN IF NOT EXISTS "cmpprivate" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "zipcode" text,
  ADD COLUMN IF NOT EXISTS "mailaddres" text,
  ADD COLUMN IF NOT EXISTS "mailzipcod" text,
  ADD COLUMN IF NOT EXISTS "phone1" text,
  ADD COLUMN IF NOT EXISTS "phone2" text,
  ADD COLUMN IF NOT EXISTS "fax" text,
  ADD COLUMN IF NOT EXISTS "cntctprsn" text,
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "balance" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dnotesbal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "ordersbal" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "groupnum" smallint,
  ADD COLUMN IF NOT EXISTS "dnotebalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "orderbalsy" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "free_text" text,
  ADD COLUMN IF NOT EXISTS "slpcode" integer,
  ADD COLUMN IF NOT EXISTS "currency" text,
  ADD COLUMN IF NOT EXISTS "ratedifact" text,
  ADD COLUMN IF NOT EXISTS "balancesys" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "cellular" text,
  ADD COLUMN IF NOT EXISTS "country" text,
  ADD COLUMN IF NOT EXISTS "mailcountr" text,
  ADD COLUMN IF NOT EXISTS "e_mail" text,
  ADD COLUMN IF NOT EXISTS "dflbranch" text,
  ADD COLUMN IF NOT EXISTS "addid" text,
  ADD COLUMN IF NOT EXISTS "fathercard" text,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "dscntobjct" smallint,
  ADD COLUMN IF NOT EXISTS "spgcounter" smallint,
  ADD COLUMN IF NOT EXISTS "sppcounter" integer,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "validfor" text,
  ADD COLUMN IF NOT EXISTS "frozenfor" text,
  ADD COLUMN IF NOT EXISTS "state1" text,
  ADD COLUMN IF NOT EXISTS "state2" text,
  ADD COLUMN IF NOT EXISTS "shiptype" smallint,
  ADD COLUMN IF NOT EXISTS "debpayacct" text,
  ADD COLUMN IF NOT EXISTS "shiptodef" text,
  ADD COLUMN IF NOT EXISTS "ecvatgroup" text,
  ADD COLUMN IF NOT EXISTS "docentry" integer,
  ADD COLUMN IF NOT EXISTS "pymcode" text,
  ADD COLUMN IF NOT EXISTS "dunnlevel" integer,
  ADD COLUMN IF NOT EXISTS "bankcountr" text,
  ADD COLUMN IF NOT EXISTS "isrbillid" text,
  ADD COLUMN IF NOT EXISTS "wtliable" text,
  ADD COLUMN IF NOT EXISTS "vatregnum" text,
  ADD COLUMN IF NOT EXISTS "repname" text,
  ADD COLUMN IF NOT EXISTS "industry" text,
  ADD COLUMN IF NOT EXISTS "business" text,
  ADD COLUMN IF NOT EXISTS "aliasname" text,
  ADD COLUMN IF NOT EXISTS "building" text,
  ADD COLUMN IF NOT EXISTS "mailbuildi" text,
  ADD COLUMN IF NOT EXISTS "billtodef" text,
  ADD COLUMN IF NOT EXISTS "dpmclear" text,
  ADD COLUMN IF NOT EXISTS "intrntsite" text,
  ADD COLUMN IF NOT EXISTS "bankctlkey" text,
  ADD COLUMN IF NOT EXISTS "housctlkey" text,
  ADD COLUMN IF NOT EXISTS "streetno" text,
  ADD COLUMN IF NOT EXISTS "opcode347" text,
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "autopost" text,
  ADD COLUMN IF NOT EXISTS "attachment" text,
  ADD COLUMN IF NOT EXISTS "atcentry" integer,
  ADD COLUMN IF NOT EXISTS "u_cardtp" text,
  ADD COLUMN IF NOT EXISTS "u_cardtpnm" text,
  ADD COLUMN IF NOT EXISTS "u_chan" text,
  ADD COLUMN IF NOT EXISTS "u_headoff" text,
  ADD COLUMN IF NOT EXISTS "u_secpamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_secsamt" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_usrid" text,
  ADD COLUMN IF NOT EXISTS "u_salockyn" text,
  ADD COLUMN IF NOT EXISTS "u_brdgrp" text,
  ADD COLUMN IF NOT EXISTS "u_etcprtyn" text,
  ADD COLUMN IF NOT EXISTS "u_closetm" text,
  ADD COLUMN IF NOT EXISTS "u_costcd" text,
  ADD COLUMN IF NOT EXISTS "u_bungbn" text,
  ADD COLUMN IF NOT EXISTS "u_adminyn" text,
  ADD COLUMN IF NOT EXISTS "u_return_yn" text,
  ADD COLUMN IF NOT EXISTS "u_return_fd" date,
  ADD COLUMN IF NOT EXISTS "u_return_td" date,
  ADD COLUMN IF NOT EXISTS "u_delyn" text,
  ADD COLUMN IF NOT EXISTS "u_trans_yn" text;
CREATE INDEX IF NOT EXISTS idx_sap_ocrd_groupcode ON public.sap_ocrd ("groupcode");
COMMENT ON TABLE public.sap_ocrd IS 'SAP OCRD 원본 미러: 거래처 마스터 (전체)';
COMMENT ON COLUMN public.sap_ocrd."u_cardtp" IS '비지니스파트너구분';
COMMENT ON COLUMN public.sap_ocrd."u_cardtpnm" IS '비지니스파트너구분명';
COMMENT ON COLUMN public.sap_ocrd."u_chan" IS '유통채널';
COMMENT ON COLUMN public.sap_ocrd."u_headoff" IS '본부';
COMMENT ON COLUMN public.sap_ocrd."u_secpamt" IS '담보가능액';
COMMENT ON COLUMN public.sap_ocrd."u_secsamt" IS '담보설정액';
COMMENT ON COLUMN public.sap_ocrd."u_usrid" IS '거래처ID';
COMMENT ON COLUMN public.sap_ocrd."u_salockyn" IS '총판판매여부';
COMMENT ON COLUMN public.sap_ocrd."u_brdgrp" IS '브랜드그룹';
COMMENT ON COLUMN public.sap_ocrd."u_etcprtyn" IS '타시스템발행여부';
COMMENT ON COLUMN public.sap_ocrd."u_closetm" IS '마감시간';
COMMENT ON COLUMN public.sap_ocrd."u_costcd" IS '코스트센터';
COMMENT ON COLUMN public.sap_ocrd."u_bungbn" IS '덩이구분';
COMMENT ON COLUMN public.sap_ocrd."u_adminyn" IS '관리자여부';
COMMENT ON COLUMN public.sap_ocrd."u_return_yn" IS '반품구분';
COMMENT ON COLUMN public.sap_ocrd."u_return_fd" IS '반품기간FROM';
COMMENT ON COLUMN public.sap_ocrd."u_return_td" IS '반품기간TO';
COMMENT ON COLUMN public.sap_ocrd."u_delyn" IS '납품처사용여부';
COMMENT ON COLUMN public.sap_ocrd."u_trans_yn" IS '이체구분';
ALTER TABLE public.sap_ocrd ENABLE ROW LEVEL SECURITY;

-- OITM: 품목 마스터 (전체) (범위: all, 컬럼 67개)
CREATE TABLE IF NOT EXISTS public.sap_oitm (
  "itemcode" text NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oitm PRIMARY KEY ("itemcode")
);
ALTER TABLE public.sap_oitm
  ADD COLUMN IF NOT EXISTS "itemname" text,
  ADD COLUMN IF NOT EXISTS "itmsgrpcod" smallint,
  ADD COLUMN IF NOT EXISTS "vatgourpsa" text,
  ADD COLUMN IF NOT EXISTS "codebars" text,
  ADD COLUMN IF NOT EXISTS "prchseitem" text,
  ADD COLUMN IF NOT EXISTS "onhand" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "iscommited" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "onorder" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "dfltwh" text,
  ADD COLUMN IF NOT EXISTS "buyunitmsr" text,
  ADD COLUMN IF NOT EXISTS "lstevlpric" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "lstevldate" date,
  ADD COLUMN IF NOT EXISTS "salunitmsr" text,
  ADD COLUMN IF NOT EXISTS "consig" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "evalsystem" text,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "treetype" text,
  ADD COLUMN IF NOT EXISTS "treeqty" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "lastpurprc" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "lastpurcur" text,
  ADD COLUMN IF NOT EXISTS "lastpurdat" date,
  ADD COLUMN IF NOT EXISTS "qrygroup1" text,
  ADD COLUMN IF NOT EXISTS "qrygroup2" text,
  ADD COLUMN IF NOT EXISTS "qrygroup3" text,
  ADD COLUMN IF NOT EXISTS "qrygroup5" text,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "vatgrouppu" text,
  ADD COLUMN IF NOT EXISTS "avgprice" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "validfor" text,
  ADD COLUMN IF NOT EXISTS "frozenfor" text,
  ADD COLUMN IF NOT EXISTS "docentry" integer,
  ADD COLUMN IF NOT EXISTS "warrnttmpl" text,
  ADD COLUMN IF NOT EXISTS "stockvalue" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "issuemthd" text,
  ADD COLUMN IF NOT EXISTS "invntryuom" text,
  ADD COLUMN IF NOT EXISTS "planingsys" text,
  ADD COLUMN IF NOT EXISTS "prcrmntmtd" text,
  ADD COLUMN IF NOT EXISTS "productsrc" text,
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "fuelcode" integer,
  ADD COLUMN IF NOT EXISTS "bevertblc" text,
  ADD COLUMN IF NOT EXISTS "bevergrpc" text,
  ADD COLUMN IF NOT EXISTS "bevertm" integer,
  ADD COLUMN IF NOT EXISTS "u_citgbn" text,
  ADD COLUMN IF NOT EXISTS "u_level1" text,
  ADD COLUMN IF NOT EXISTS "u_selyn" text,
  ADD COLUMN IF NOT EXISTS "u_level2" text,
  ADD COLUMN IF NOT EXISTS "u_clsno" text,
  ADD COLUMN IF NOT EXISTS "u_oitemcd" text,
  ADD COLUMN IF NOT EXISTS "u_bununit" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_midtp" text,
  ADD COLUMN IF NOT EXISTS "u_level3" text,
  ADD COLUMN IF NOT EXISTS "u_level4" text,
  ADD COLUMN IF NOT EXISTS "u_itemtp" text,
  ADD COLUMN IF NOT EXISTS "u_reldate" date,
  ADD COLUMN IF NOT EXISTS "u_price" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "u_return_yn" text,
  ADD COLUMN IF NOT EXISTS "u_ocrgb" text,
  ADD COLUMN IF NOT EXISTS "u_level1nm" text,
  ADD COLUMN IF NOT EXISTS "u_level2nm" text,
  ADD COLUMN IF NOT EXISTS "u_level3nm" text,
  ADD COLUMN IF NOT EXISTS "u_level4nm" text,
  ADD COLUMN IF NOT EXISTS "u_type" text,
  ADD COLUMN IF NOT EXISTS "u_itemcost" text;
CREATE INDEX IF NOT EXISTS idx_sap_oitm_itmsgrpcod ON public.sap_oitm ("itmsgrpcod");
COMMENT ON TABLE public.sap_oitm IS 'SAP OITM 원본 미러: 품목 마스터 (전체)';
COMMENT ON COLUMN public.sap_oitm."u_citgbn" IS '품목구분(원가)';
COMMENT ON COLUMN public.sap_oitm."u_level1" IS '대표브랜드';
COMMENT ON COLUMN public.sap_oitm."u_selyn" IS '판매가능';
COMMENT ON COLUMN public.sap_oitm."u_level2" IS '패밀리브랜드';
COMMENT ON COLUMN public.sap_oitm."u_clsno" IS '채번클래스';
COMMENT ON COLUMN public.sap_oitm."u_oitemcd" IS '구품목번호';
COMMENT ON COLUMN public.sap_oitm."u_bununit" IS '덩이수량';
COMMENT ON COLUMN public.sap_oitm."u_midtp" IS '용지중분류';
COMMENT ON COLUMN public.sap_oitm."u_level3" IS '서브브랜드';
COMMENT ON COLUMN public.sap_oitm."u_level4" IS '모디파이어';
COMMENT ON COLUMN public.sap_oitm."u_itemtp" IS '품목유형';
COMMENT ON COLUMN public.sap_oitm."u_reldate" IS '교재출시일자';
COMMENT ON COLUMN public.sap_oitm."u_price" IS '정가';
COMMENT ON COLUMN public.sap_oitm."u_return_yn" IS '반품여부';
COMMENT ON COLUMN public.sap_oitm."u_ocrgb" IS '코스트기준';
COMMENT ON COLUMN public.sap_oitm."u_level1nm" IS '대표브랜드이름';
COMMENT ON COLUMN public.sap_oitm."u_level2nm" IS '패밀리브랜드이름';
COMMENT ON COLUMN public.sap_oitm."u_level3nm" IS '서브브랜드이름';
COMMENT ON COLUMN public.sap_oitm."u_level4nm" IS '모디파이어이름';
COMMENT ON COLUMN public.sap_oitm."u_type" IS '주문구분';
COMMENT ON COLUMN public.sap_oitm."u_itemcost" IS '품목별코스트';
ALTER TABLE public.sap_oitm ENABLE ROW LEVEL SECURITY;

-- OCRG: 거래처 그룹 (범위: all, 컬럼 5개)
CREATE TABLE IF NOT EXISTS public.sap_ocrg (
  "groupcode" smallint NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_ocrg PRIMARY KEY ("groupcode")
);
ALTER TABLE public.sap_ocrg
  ADD COLUMN IF NOT EXISTS "groupname" text,
  ADD COLUMN IF NOT EXISTS "grouptype" text,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "usersign" smallint;
COMMENT ON TABLE public.sap_ocrg IS 'SAP OCRG 원본 미러: 거래처 그룹';
ALTER TABLE public.sap_ocrg ENABLE ROW LEVEL SECURITY;

-- OITB: 품목 그룹 (범위: all, 컬럼 35개)
CREATE TABLE IF NOT EXISTS public.sap_oitb (
  "itmsgrpcod" smallint NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oitb PRIMARY KEY ("itmsgrpcod")
);
ALTER TABLE public.sap_oitb
  ADD COLUMN IF NOT EXISTS "itmsgrpnam" text,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "balinvntac" text,
  ADD COLUMN IF NOT EXISTS "salecostac" text,
  ADD COLUMN IF NOT EXISTS "transferac" text,
  ADD COLUMN IF NOT EXISTS "revenuesac" text,
  ADD COLUMN IF NOT EXISTS "varianceac" text,
  ADD COLUMN IF NOT EXISTS "decreasac" text,
  ADD COLUMN IF NOT EXISTS "increasac" text,
  ADD COLUMN IF NOT EXISTS "returnac" text,
  ADD COLUMN IF NOT EXISTS "expensesac" text,
  ADD COLUMN IF NOT EXISTS "frrevenuac" text,
  ADD COLUMN IF NOT EXISTS "frexpensac" text,
  ADD COLUMN IF NOT EXISTS "pricedifac" text,
  ADD COLUMN IF NOT EXISTS "exchangeac" text,
  ADD COLUMN IF NOT EXISTS "balanceacc" text,
  ADD COLUMN IF NOT EXISTS "decresglac" text,
  ADD COLUMN IF NOT EXISTS "incresglac" text,
  ADD COLUMN IF NOT EXISTS "invntsys" text,
  ADD COLUMN IF NOT EXISTS "prcrmntmtd" text,
  ADD COLUMN IF NOT EXISTS "wipacct" text,
  ADD COLUMN IF NOT EXISTS "wipvaracct" text,
  ADD COLUMN IF NOT EXISTS "expclract" text,
  ADD COLUMN IF NOT EXISTS "createdate" date,
  ADD COLUMN IF NOT EXISTS "usersign2" smallint,
  ADD COLUMN IF NOT EXISTS "updatedate" date,
  ADD COLUMN IF NOT EXISTS "arcmact" text,
  ADD COLUMN IF NOT EXISTS "arcmfrnact" text,
  ADD COLUMN IF NOT EXISTS "apcmact" text,
  ADD COLUMN IF NOT EXISTS "apcmfrnact" text,
  ADD COLUMN IF NOT EXISTS "negstckact" text,
  ADD COLUMN IF NOT EXISTS "stkintnact" text,
  ADD COLUMN IF NOT EXISTS "wipoffset" text,
  ADD COLUMN IF NOT EXISTS "stockoffst" text;
COMMENT ON TABLE public.sap_oitb IS 'SAP OITB 원본 미러: 품목 그룹';
ALTER TABLE public.sap_oitb ENABLE ROW LEVEL SECURITY;

-- OOCR: 배부규칙(코스트센터) (범위: all, 컬럼 4개)
CREATE TABLE IF NOT EXISTS public.sap_oocr (
  "ocrcode" text NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oocr PRIMARY KEY ("ocrcode")
);
ALTER TABLE public.sap_oocr
  ADD COLUMN IF NOT EXISTS "ocrname" text,
  ADD COLUMN IF NOT EXISTS "dimcode" smallint,
  ADD COLUMN IF NOT EXISTS "active" text;
COMMENT ON TABLE public.sap_oocr IS 'SAP OOCR 원본 미러: 배부규칙(코스트센터)';
ALTER TABLE public.sap_oocr ENABLE ROW LEVEL SECURITY;

-- OSLP: 영업사원 (범위: all, 컬럼 8개)
CREATE TABLE IF NOT EXISTS public.sap_oslp (
  "slpcode" integer NOT NULL,
  "_synced_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_oslp PRIMARY KEY ("slpcode")
);
ALTER TABLE public.sap_oslp
  ADD COLUMN IF NOT EXISTS "slpname" text,
  ADD COLUMN IF NOT EXISTS "memo" text,
  ADD COLUMN IF NOT EXISTS "commission" numeric(19,6),
  ADD COLUMN IF NOT EXISTS "locked" text,
  ADD COLUMN IF NOT EXISTS "datasource" text,
  ADD COLUMN IF NOT EXISTS "usersign" smallint,
  ADD COLUMN IF NOT EXISTS "active" text;
COMMENT ON TABLE public.sap_oslp IS 'SAP OSLP 원본 미러: 영업사원';
ALTER TABLE public.sap_oslp ENABLE ROW LEVEL SECURITY;

-- 동기화 상태 (테이블별 증분 기준 시점)
CREATE TABLE IF NOT EXISTS public.sap_mirror_state (
  "table_name"        text PRIMARY KEY,
  "last_update_date"  date,
  "last_update_ts"    integer,
  "last_doc_entry"    integer,
  "initial_loaded_at" timestamptz,
  "last_synced_at"    timestamptz
);
ALTER TABLE public.sap_mirror_state ENABLE ROW LEVEL SECURITY;

-- 동기화 실행 이력
CREATE TABLE IF NOT EXISTS public.sap_mirror_runs (
  "id"          bigserial PRIMARY KEY,
  "mode"        text NOT NULL,                     -- init | sync | recon | backfill
  "table_name"  text,
  "started_at"  timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "status"      text NOT NULL DEFAULT 'running',   -- running | success | failed
  "rows"        integer,
  "message"     text
);
ALTER TABLE public.sap_mirror_runs ENABLE ROW LEVEL SECURITY;

-- 대사 결과 (월별 SAP vs Supabase 건수/금액)
CREATE TABLE IF NOT EXISTS public.sap_mirror_recon (
  "table_name"  text NOT NULL,
  "ym"          text NOT NULL,                     -- YYYY-MM
  "sap_rows"    bigint,
  "mirror_rows" bigint,
  "sap_sum"     numeric(19,6),
  "mirror_sum"  numeric(19,6),
  "checked_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_mirror_recon PRIMARY KEY ("table_name", "ym")
);
ALTER TABLE public.sap_mirror_recon ENABLE ROW LEVEL SECURITY;

-- 적재 대상 거래처 등록부 (loaded_at이 있는 거래처만 증분 동기화 대상)
CREATE TABLE IF NOT EXISTS public.sap_mirror_customers (
  "cardcode"     text PRIMARY KEY,
  "elt"          boolean NOT NULL DEFAULT true,    -- 현재 SAP 기준 ELT 거래처 여부
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz,
  "loaded_at"    timestamptz                       -- 초기 적재 완료 시각
);
ALTER TABLE public.sap_mirror_customers ENABLE ROW LEVEL SECURITY;

-- 초기 적재 진행 상황 (중단 후 이어하기용, 테이블 x 거래처 단위)
CREATE TABLE IF NOT EXISTS public.sap_mirror_init_progress (
  "table_name" text NOT NULL,
  "cardcode"   text NOT NULL,                      -- 마스터는 '*'
  "rows"       integer,
  "done_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_sap_mirror_init_progress PRIMARY KEY ("table_name", "cardcode")
);
ALTER TABLE public.sap_mirror_init_progress ENABLE ROW LEVEL SECURITY;
-- RLS 정책 없음 = anon/authenticated 접근 불가, 서비스 키(동기화 스크립트·서버)만 접근.

-- 미러 테이블 upsert: p_rows(JSON 배열, 키=컬럼명)를 기본키 기준으로 삽입/갱신
CREATE OR REPLACE FUNCTION public.sap_mirror_upsert(p_table text, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_rel regclass;
  v_pk text;
  v_cols text;
  v_set text;
  v_n integer;
BEGIN
  IF p_table !~ '^sap_[a-z0-9]+$' THEN
    RAISE EXCEPTION 'invalid mirror table: %', p_table;
  END IF;
  IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;
  v_rel := ('public.' || p_table)::regclass;
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
    INTO v_pk
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
   WHERE i.indrelid = v_rel AND i.indisprimary;
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
         string_agg(quote_ident(a.attname) || ' = EXCLUDED.' || quote_ident(a.attname), ', ' ORDER BY a.attnum)
           FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM pg_index i WHERE i.indrelid = v_rel AND i.indisprimary AND a.attnum = ANY (i.indkey)))
    INTO v_cols, v_set
    FROM pg_attribute a
   WHERE a.attrelid = v_rel AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> '_synced_at';
  EXECUTE format(
    'INSERT INTO public.%I (%s, _synced_at) SELECT %s, now() FROM jsonb_populate_recordset(NULL::public.%I, $1) '
    'ON CONFLICT (%s) DO UPDATE SET %s, _synced_at = now()',
    p_table, v_cols, v_cols, p_table, v_pk, v_set)
  USING p_rows;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- 문서 교체(한 트랜잭션): 헤더 upsert + 해당 문서의 라인 전체 삭제 후 재삽입
-- (라인 수정/삭제/종료까지 반영). p_key: 'docentry'(판매 문서) 또는 'transid'(분개)
CREATE OR REPLACE FUNCTION public.sap_mirror_replace_docs(
  p_header_table text, p_line_table text, p_key text, p_headers jsonb, p_lines jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_line_table !~ '^sap_[a-z0-9]+$' OR p_key NOT IN ('docentry', 'transid') THEN
    RAISE EXCEPTION 'invalid arguments: % %', p_line_table, p_key;
  END IF;
  PERFORM public.sap_mirror_upsert(p_header_table, p_headers);
  EXECUTE format(
    'DELETE FROM public.%I WHERE %I IN (SELECT (e ->> %L)::integer FROM jsonb_array_elements($1) e)',
    p_line_table, p_key, p_key)
  USING p_headers;
  v_n := public.sap_mirror_upsert(p_line_table, COALESCE(p_lines, '[]'::jsonb));
  RETURN v_n;
END
$fn$;

-- 대사용 월별 건수/합계 (p_sub_col이 있으면 합계 = p_sum_col - p_sub_col)
CREATE OR REPLACE FUNCTION public.sap_mirror_month_stats(
  p_table text, p_date_col text, p_sum_col text, p_sub_col text DEFAULT NULL)
RETURNS TABLE (ym text, cnt bigint, total numeric)
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF p_table !~ '^sap_[a-z0-9]+$' OR p_date_col !~ '^[a-z0-9_]+$' OR p_sum_col !~ '^[a-z0-9_]+$'
     OR (p_sub_col IS NOT NULL AND p_sub_col !~ '^[a-z0-9_]+$') THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT to_char(%I, ''YYYY-MM''), count(*)::bigint, COALESCE(sum(%I %s), 0)::numeric FROM public.%I GROUP BY 1',
    p_date_col, p_sum_col,
    CASE WHEN p_sub_col IS NULL THEN '' ELSE format('- %I', p_sub_col) END,
    p_table);
END
$fn$;

-- 마스터 정리: SAP에 더 이상 없는 키 삭제 (p_keys: 현재 SAP 키 전체 JSON 배열)
CREATE OR REPLACE FUNCTION public.sap_mirror_delete_missing(p_table text, p_key text, p_keys jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_n integer;
BEGIN
  IF p_table !~ '^sap_[a-z0-9]+$' OR p_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  IF p_keys IS NULL OR jsonb_array_length(p_keys) = 0 THEN
    RAISE EXCEPTION 'empty key list (refusing to delete all rows)';
  END IF;
  EXECUTE format(
    'DELETE FROM public.%I t WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text($1) k WHERE k = t.%I::text)',
    p_table, p_key)
  USING p_keys;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- 함수는 서비스 키에서만 실행 가능
REVOKE ALL ON FUNCTION public.sap_mirror_upsert(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sap_mirror_replace_docs(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sap_mirror_month_stats(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sap_mirror_delete_missing(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sap_mirror_upsert(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_replace_docs(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_month_stats(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_delete_missing(text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
