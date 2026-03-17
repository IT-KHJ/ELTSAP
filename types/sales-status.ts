/** 거래처 현황(판매기준) API 응답/요청 타입 */

export interface SalesStatusRow {
  docdate: string;
  basecard: string;
  cardname: string | null;
  aliasname: string | null;
  itemcode: string | null;
  itemname: string | null;
  price: number | null;
  supplyRate: number | null;
  discountRate: number | null;
  quantity: number | null;
  salesAmount: number | null;
  returnAmount: number | null;
  netSales: number | null;
}

export interface SalesStatusSummary {
  totalSales: number;
  totalReturns: number;
  netSales: number;
}

export interface SalesStatusResponse {
  rows: SalesStatusRow[];
  summary: SalesStatusSummary;
  hasMore: boolean;
  sapFetchFailed?: boolean;
  sapError?: string;
}
