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
  inamt: InamtMonthly;
  giftQty: GiftQtyMonthly;
  topItems: TopItemRow[];
  topBrands: TopBrandRow[];
}
