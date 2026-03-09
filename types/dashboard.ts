/** 거래처 매출 대시보드 API 응답/요청 타입 */

export interface DashboardSummary {
  activeCustomers: number;
  totalSales: number;
  totalReturns: number;
  netSales: number;
  top10Concentration: number;
  yoyGrowth: string;
  startDate: string;
  endDate: string;
}

export interface CustomerRankingRow {
  cardcode: string;
  cardname: string | null;
  aliasname: string | null;
  sales: number;
  netSales: number;
  returns: number;
  returnRate: number;
  orderCount: number;
  sharePercent: number;
  yoy: string;
  mom: string;
  rank: number;
}

export interface DashboardRankingResponse {
  rows: CustomerRankingRow[];
  totalCount: number;
  page: number;
  limit: number;
}

export interface CustomerDetailMonthly {
  month: string;
  sales: number;
  returns: number;
  netSales: number;
}

export interface CustomerDetailItemSales {
  itemcode: string;
  itemname: string | null;
  sales: number;
  quantity: number;
}

export interface CustomerDetailResponse {
  cardcode: string;
  cardname: string | null;
  monthly: CustomerDetailMonthly[];
  itemSales: CustomerDetailItemSales[];
  returnTrend: CustomerDetailMonthly[];
  startDate: string;
  endDate: string;
}

export interface ParetoRow {
  cardcode: string;
  aliasname: string | null;
  sales: number;
  cumulativeSales: number;
  cumulativePercent: number;
  rank: number;
}

export interface DashboardInsightRow {
  cardcode: string;
  aliasname: string | null;
  prevYear: number;
  currYear: number;
  changePercent: string;
  changeSymbol: string; // "▲" | "▼" | "-"
  /** 반품율 높은 거래처 전용: 당기 반품율(%) - 정렬용 */
  returnRate?: number;
  /** 반품율 높은 거래처 전용: 전년 반품 금액(절대값) */
  prevReturnAmount?: number;
  /** 반품율 높은 거래처 전용: 당해 반품 금액(절대값) */
  currReturnAmount?: number;
  /** 반품율 높은 거래처 전용: 전년 반품 대비 당해 반품 증감률 */
  returnAmountChangePct?: number;
}

export interface DashboardInsightsResponse {
  salesDecline: DashboardInsightRow[];
  highReturnRate: DashboardInsightRow[];
  salesGrowth: DashboardInsightRow[];
}
