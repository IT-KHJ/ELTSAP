/** 보고서 관련 상수 (하드코딩 금지) */

/** itmsgrpcod → 보고서 카테고리 */
export const CATEGORY_BG = "100";
export const CATEGORY_OUP = "101";
export const LABEL_BG = "B&G 매출";
export const LABEL_OUP = "OUP 매출";
export const LABEL_BG_RETURN = "B&G 반품";
export const LABEL_OUP_RETURN = "OUP 반품";
/** 중고등 거래처는 B&G 대신 "중고등" 표기 (2026-11-05 사용자 결정, OUP는 그대로) */
export const LABEL_JHG = "중고등 매출";
export const LABEL_JHG_RETURN = "중고등 반품";
export const LABEL_ETC = "기타";
/** 중고등 과목 하위 행 (마감기준, 2026-11-06 사용자 결정 B안). SAP 판매 부서(INV1/RIN1.OcrCode2) → 과목 */
export const SUBJECT_ORDER = ["영어", "수학", "국어"] as const;
export const SUBJECT_BY_OCRCODE2: Record<string, (typeof SUBJECT_ORDER)[number]> = {
  "2102": "영어",
  "2103": "영어", // 수험영어
  "2601": "수학",
  "2801": "국어",
};
/** 이 과목에 데이터가 있을 때만 과목별로 나눠 표시 */
export const SPLIT_TRIGGER_SUBJECTS = ["수학", "국어"] as const;

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** 거래처 구분(사업부). 값은 rpt_segment(038_rpt_segment.sql)의 segment, ALL = 전체 */
export type Segment = "ALL" | "ELT" | "중고등";
export const SEGMENT_OPTIONS: { value: Segment; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "ELT", label: "ELT" },
  { value: "중고등", label: "중고등" },
];
/** 조회 화면 기본값 (2026-11-05 사용자 결정: 전 화면 중고등) */
export const DEFAULT_SEGMENT: Segment = "중고등";

export function parseSegment(v: string | null | undefined): Segment {
  return SEGMENT_OPTIONS.some((o) => o.value === v) ? (v as Segment) : DEFAULT_SEGMENT;
}

