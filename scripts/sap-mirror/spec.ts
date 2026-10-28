/**
 * SAP 원본 미러 계층 명세(schema.json) 로더와 SAP SELECT 목록 생성.
 * schema.json이 유일한 기준이며, DDL 생성기와 동기화 엔진이 모두 이 모듈을 통해 읽는다.
 */

import { readFileSync } from "fs";
import path from "path";

export interface ColumnSpec {
  sap: string;
  pg: string;
  sapType: string;
  pgType: string;
  descr: string | null;
  reason: string;
}

export interface TableSpec {
  sap: string;
  pg: string;
  family: string | null;
  descr: string;
  scope: string;
  pk: string[];
  indexes: string[][];
  excludedColumns: { sap: string; reason: string }[];
  columns: ColumnSpec[];
}

export interface MirrorSpec {
  version: number;
  prefix: string;
  eltCustomerFilter: string;
  tables: TableSpec[];
}

export const SPEC_PATH = path.join(__dirname, "schema.json");

export function loadSpec(): MirrorSpec {
  return JSON.parse(readFileSync(SPEC_PATH, "utf8")) as MirrorSpec;
}

export function getTable(spec: MirrorSpec, sap: string): TableSpec {
  const t = spec.tables.find((x) => x.sap === sap);
  if (!t) throw new Error(`schema.json에 ${sap} 테이블이 없습니다.`);
  return t;
}

/**
 * SAP SELECT 컬럼 목록. 값 손실 방지를 위해 SAP에서 문자열로 변환해 꺼낸다.
 * - numeric: 문자열 그대로 (JS number 변환 시 소수 정밀도 손실 방지)
 * - date: YYYY-MM-DD 문자열 (시간대 영향 제거), timestamp: YYYY-MM-DD hh:mi:ss.mmm
 * 별칭은 Supabase 컬럼명(소문자)과 동일.
 */
export function selectList(t: TableSpec, alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return t.columns
    .map((c) => {
      const col = `${p}[${c.sap}]`;
      let expr = col;
      if (c.pgType.startsWith("numeric")) expr = `CONVERT(varchar(50), ${col})`;
      else if (c.pgType === "date") expr = `CONVERT(char(10), ${col}, 23)`;
      else if (c.pgType === "timestamp") expr = `CONVERT(varchar(23), ${col}, 121)`;
      return `${expr} AS [${c.pg}]`;
    })
    .join(", ");
}
