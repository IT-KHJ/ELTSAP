/** 거래처 거래원장 API 응답 타입 (SAP 원본 미러 sap_* 기반, rpt_ledger 함수) */

export interface LedgerRow {
  /** 0 = 전기이월 행, 1부터 거래 순번 */
  seq: number;
  txdate: string | null;
  docnum: number | null;
  /** 전기이월 | 매출(송장) | 대변메모 | 입금 | 채권조정 */
  gubun: string;
  descr: string | null;
  qty: number | null;
  occur: number;
  cancel: number;
  collect: number;
  balance: number;
  remark: string | null;
}

export interface LedgerTotals {
  opening: number;
  occur: number;
  cancel: number;
  collect: number;
  closing: number;
}

export interface LedgerResponse {
  cardcode: string;
  cardname: string;
  startDate: string;
  endDate: string;
  rows: LedgerRow[];
  totals: LedgerTotals;
}

export type LedgerCustomerOption = { cardcode: string; cardname: string | null };
