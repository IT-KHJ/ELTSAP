/**
 * SAP 원본 미러 계층 DDL 생성기
 * 실행: npx tsx scripts/sap-mirror/generate-ddl.ts <출력 SQL 경로>
 * 예:   npx tsx scripts/sap-mirror/generate-ddl.ts supabase/migrations/026_sap_mirror_add_xxx.sql
 *
 * scripts/sap-mirror/schema.json(유일한 기준)을 읽어 멱등 DDL을 만든다.
 * - 테이블: CREATE TABLE IF NOT EXISTS (기본키 + _synced_at) 후 컬럼은 모두 ADD COLUMN IF NOT EXISTS
 *   → 명세에 테이블/컬럼을 추가하고 다시 생성·적용하면 새로 추가된 것만 반영된다.
 * - 인덱스: CREATE INDEX IF NOT EXISTS
 * - 컬럼 삭제/타입 변경은 자동으로 하지 않는다(데이터 보호). 필요 시 별도 마이그레이션으로 처리.
 * - RLS는 켜고 정책은 만들지 않는다 → 서비스 키(동기화 스크립트/서버)만 접근 가능.
 */

import { writeFileSync } from "fs";
import { loadSpec, type MirrorSpec, type TableSpec } from "./spec";

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

function validate(spec: MirrorSpec): void {
  const tableNames = new Set<string>();
  for (const t of spec.tables) {
    if (!t.pg.startsWith(spec.prefix)) throw new Error(`${t.sap}: 테이블명은 ${spec.prefix}로 시작해야 합니다 (${t.pg})`);
    if (tableNames.has(t.pg)) throw new Error(`중복 테이블: ${t.pg}`);
    tableNames.add(t.pg);
    const cols = new Set<string>();
    for (const c of t.columns) {
      if (cols.has(c.pg)) throw new Error(`${t.pg}: 중복 컬럼 ${c.pg}`);
      cols.add(c.pg);
    }
    const excluded = new Set(t.excludedColumns.map((e) => e.sap));
    for (const c of t.columns) {
      if (excluded.has(c.sap)) throw new Error(`${t.pg}: 제외 컬럼 ${c.sap}가 columns에 포함되어 있습니다`);
    }
    for (const k of t.pk) {
      if (!t.columns.some((c) => c.sap === k)) throw new Error(`${t.pg}: 기본키 ${k}가 columns에 없습니다`);
    }
    for (const idx of t.indexes) {
      for (const c of idx) if (!cols.has(c)) throw new Error(`${t.pg}: 인덱스 컬럼 ${c}가 columns에 없습니다`);
    }
  }
}

function tableDdl(t: TableSpec): string[] {
  const out: string[] = [];
  const pkCols = t.columns.filter((c) => t.pk.includes(c.sap));
  out.push(`-- ${t.sap}: ${t.descr} (범위: ${t.scope}, 컬럼 ${t.columns.length}개)`);
  out.push(`CREATE TABLE IF NOT EXISTS public.${t.pg} (`);
  out.push(
    [
      ...pkCols.map((c) => `  ${ident(c.pg)} ${c.pgType} NOT NULL`),
      `  "_synced_at" timestamptz NOT NULL DEFAULT now()`,
      `  CONSTRAINT pk_${t.pg} PRIMARY KEY (${t.pk.map((k) => ident(k.toLowerCase())).join(", ")})`,
    ].join(",\n")
  );
  out.push(");");
  const addCols = t.columns.filter((c) => !t.pk.includes(c.sap));
  if (addCols.length) {
    out.push(`ALTER TABLE public.${t.pg}`);
    out.push(addCols.map((c) => `  ADD COLUMN IF NOT EXISTS ${ident(c.pg)} ${c.pgType}`).join(",\n") + ";");
  }
  for (const idx of t.indexes) {
    out.push(
      `CREATE INDEX IF NOT EXISTS idx_${t.pg}_${idx.join("_")} ON public.${t.pg} (${idx.map(ident).join(", ")});`
    );
  }
  out.push(`COMMENT ON TABLE public.${t.pg} IS ${literal(`SAP ${t.sap} 원본 미러: ${t.descr}`)};`);
  for (const c of t.columns) {
    if (c.descr) out.push(`COMMENT ON COLUMN public.${t.pg}.${ident(c.pg)} IS ${literal(c.descr)};`);
  }
  out.push(`ALTER TABLE public.${t.pg} ENABLE ROW LEVEL SECURITY;`);
  out.push("");
  return out;
}

const MANAGEMENT_DDL = `-- 동기화 상태 (테이블별 증분 기준 시점)
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
-- p_from/p_to: [p_from, p_to) 기간만 집계 (최근 대사, 전체 대사는 연 단위로 나눠 호출 — API 시간 제한 대응)
-- p_header_table: 라인 테이블을 헤더와 조인해 헤더 날짜(p_date_col) 기준으로 집계
DROP FUNCTION IF EXISTS public.sap_mirror_month_stats(text, text, text, text);
DROP FUNCTION IF EXISTS public.sap_mirror_month_stats(text, text, text, text, date, text);
CREATE OR REPLACE FUNCTION public.sap_mirror_month_stats(
  p_table text, p_date_col text, p_sum_col text, p_sub_col text DEFAULT NULL,
  p_from date DEFAULT NULL, p_header_table text DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE (ym text, cnt bigint, total numeric)
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_src text;
  v_date text;
BEGIN
  IF p_table !~ '^sap_[a-z0-9]+$' OR p_date_col !~ '^[a-z0-9_]+$' OR p_sum_col !~ '^[a-z0-9_]+$'
     OR (p_sub_col IS NOT NULL AND p_sub_col !~ '^[a-z0-9_]+$')
     OR (p_header_table IS NOT NULL AND p_header_table !~ '^sap_[a-z0-9]+$') THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  IF p_header_table IS NULL THEN
    v_src := format('public.%I t', p_table);
    v_date := format('t.%I', p_date_col);
  ELSE
    v_src := format('public.%I t JOIN public.%I h ON h.docentry = t.docentry', p_table, p_header_table);
    v_date := format('h.%I', p_date_col);
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT to_char(%s, ''YYYY-MM''), count(*)::bigint, COALESCE(sum(t.%I %s), 0)::numeric FROM %s WHERE ($1 IS NULL OR %s >= $1) AND ($2 IS NULL OR %s < $2) GROUP BY 1',
    v_date, p_sum_col,
    CASE WHEN p_sub_col IS NULL THEN '' ELSE format('- t.%I', p_sub_col) END,
    v_src, v_date, v_date)
  USING p_from, p_to;
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
REVOKE ALL ON FUNCTION public.sap_mirror_month_stats(text, text, text, text, date, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sap_mirror_delete_missing(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sap_mirror_upsert(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_replace_docs(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_month_stats(text, text, text, text, date, text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.sap_mirror_delete_missing(text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
`;

function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error("사용법: npx tsx scripts/sap-mirror/generate-ddl.ts <출력 SQL 경로>");
    process.exit(1);
  }
  const spec = loadSpec();
  validate(spec);

  const lines: string[] = [
    "-- SAP 원본 미러 계층 DDL (scripts/sap-mirror/generate-ddl.ts로 자동 생성 — 직접 수정하지 말 것)",
    `-- 기준: scripts/sap-mirror/schema.json (version ${spec.version})`,
    "-- 원칙: SAP 값을 변환 없이 보관(컬럼명은 소문자), 업무 규칙은 리포트 함수에서 적용. 기존 테이블/동기화와 독립.",
    `-- 범위: 문서는 ELT 거래처(${spec.eltCustomerFilter}) 기준, 마스터는 전체. 개인정보 컬럼은 제외.`,
    "-- 멱등: 여러 번 실행해도 안전하며, 명세에 새로 추가된 테이블/컬럼/인덱스만 반영된다.",
    "",
  ];
  for (const t of spec.tables) lines.push(...tableDdl(t));
  lines.push(MANAGEMENT_DDL);

  writeFileSync(outPath, lines.join("\n"), "utf8");
  const colCount = spec.tables.reduce((n, t) => n + t.columns.length, 0);
  console.log(`생성 완료: ${outPath} (테이블 ${spec.tables.length}개, 컬럼 ${colCount}개)`);
}

main();
