/** 동기화 API 요청 body 타입 (외부 ETL이 POST로 전달) */

import type { CustomerRow, ItemlistRow, SalesRow, InamtRow, SaleetcRow } from "./database";

/** SAP OCRD → CUSTOMER. groupcode는 DB에서 SMALLINT */
export interface SyncCustomerPayload {
  data: Array<Omit<CustomerRow, "groupcode"> & { groupcode?: number }>;
}

/** SAP OITM → ITEMLIST */
export interface SyncItemlistPayload {
  data: ItemlistRow[];
}

/** SAP INV1 → SALES. id 제외, linenum 있으면 사용 없으면 0 */
export interface SyncSalesPayload {
  data: Array<Omit<SalesRow, "id"> & { linenum?: number }>;
}

/** SAP ORCT → INAMT */
export interface SyncInamtPayload {
  data: InamtRow[];
}

/** SAP IGE1 → SALEETC */
export interface SyncSaleetcPayload {
  data: Array<Omit<SaleetcRow, "id"> & { linenum?: number }>;
}

export interface SyncResult {
  success: boolean;
  inserted: number;
  updated: number;
  error?: string;
}
