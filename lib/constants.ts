/** 보고서/동기화 관련 상수 (하드코딩 금지) */

export const DATE_MIN_SYNC = "2024-01-01";

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
