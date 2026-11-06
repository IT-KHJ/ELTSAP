/** 거래처 현황 보고서 API 응답/요청 타입 */

export interface ReportParams {
  cardcode: string;
  startDate: string; // ISO date
  endDate: string;
}

/** 월별 금액 (1~12 + total) */
export interface MonthlyAmount {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  "6": number;
  "7": number;
  "8": number;
  "9": number;
  "10": number;
  "11": number;
  "12": number;
  total: number;
}

/** B&G / OUP 등 카테고리별 매출 */
export interface SalesByCategory {
  categoryCode: string;
  categoryLabel: string;
  currentYear: MonthlyAmount;
  previousYear: MonthlyAmount;
  changePercent: Partial<MonthlyAmount> & { total?: number };
}

/** 채권: 요청금액(빈칸), 실제입금액, 회수율(빈칸) */
export interface InamtMonthly {
  currentYear: MonthlyAmount;
  previousYear: MonthlyAmount;
  changePercent: Partial<MonthlyAmount> & { total?: number };
}

/** 증정 수량 */
export interface GiftQtyMonthly {
  currentYear: MonthlyAmount;
  previousYear: MonthlyAmount;
  changePercent: Partial<MonthlyAmount> & { total?: number };
}

/** 주요 품목 판매 (교재명, 2024, 2025, 증감) - 품목별 수량 */
export interface TopItemRow {
  itemcode: string;
  itemname: string;
  qtyCurrent: number;
  qtyPrevious: number;
  changePercent: string;
  isIncrease: boolean | null;
}

/** 주요품목 판매 현황 - brand별 집계 (교재명 = brand, SUM(quantity)) */
export interface TopBrandRow {
  brand: string;
  qtyCurrent: number;
  qtyPrevious: number;
  changePercent: string;
  isIncrease: boolean | null;
}

export interface ReportData {
  cardcode: string;
  cardname: string;
  /** 거래처 사업부 (ELT / 중고등). 중고등이면 "지사명", "중고등" 표기 */
  segment: string | null;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  summary: {
    totalCurrent: number;
    totalPrevious: number;
    changePercent: string;
    diffAmount: number;
    returnTotalCurrent: number;
    returnTotalPrevious: number;
    returnChangePercent: string;
    returnDiffAmount: number;
  };
  salesByCategory: SalesByCategory[];
  returnsByCategory: SalesByCategory[];
  /** 중고등 과목별 하위 행(영어/수학/국어). 수학·국어 데이터가 없으면 빈 배열. 합계(summary)에는 포함하지 않음 */
  subjectSales: SalesByCategory[];
  subjectReturns: SalesByCategory[];
  inamt: InamtMonthly;
  giftQty: GiftQtyMonthly;
  topItems: TopItemRow[];
  topBrands: TopBrandRow[];
}
