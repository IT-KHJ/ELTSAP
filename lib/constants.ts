/** 보고서/동기화 관련 상수 (하드코딩 금지) */

/** 전체 동기화 기준일: 당월 기준 -2개월 1일 (예: 4월 → 2월 1일) */
export function getDateMinSync(): string {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1 - 2; // 1-based, minus 2
  if (month <= 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** itmsgrpcod → 보고서 카테고리 */
export const CATEGORY_BG = "100";
export const CATEGORY_OUP = "101";
export const LABEL_BG = "B&G 매출";
export const LABEL_OUP = "OUP 매출";
export const LABEL_BG_RETURN = "B&G 반품";
export const LABEL_OUP_RETURN = "OUP 반품";
export const LABEL_ETC = "기타";

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const BATCH_SIZE = 1000;
