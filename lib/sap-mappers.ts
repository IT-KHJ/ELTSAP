/**
 * SAP SQL Server 레코드를 Supabase 행 타입으로 변환.
 * SQL Server 반환 타입(null, Date, number) 정규화.
 */

import type { CustomerRow, ItemlistRow, SalesRow, InamtRow, SaleetcRow } from "@/types/database";

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  const s = String(v);
  return s === "" ? null : s;
}

export function mapSapRowToCustomer(r: Record<string, unknown>): CustomerRow {
  return {
    cardcode: String(r.cardcode ?? r.CardCode ?? "").trim() || "",
    cardname: toStr(r.cardname ?? r.CardName),
    groupcode: toNum(r.groupcode ?? r.GroupCode),
    address: toStr(r.address ?? r.Address),
    zipcode: toStr(r.zipcode ?? r.ZipCode),
    phone1: toStr(r.phone1 ?? r.Phone1),
    phone2: toStr(r.phone2 ?? r.Phone2),
    fax: toStr(r.fax ?? r.Fax),
    cntctprsn: toStr(r.cntctprsn ?? r.CntctPrsn),
    notes: toStr(r.notes ?? r.Notes),
    e_mail: toStr(r.e_mail ?? r.E_Mail),
    shiptodef: toStr(r.shiptodef ?? r.ShipToDef),
    vatregnum: toStr(r.vatregnum ?? r.VatRegNum),
    repname: toStr(r.repname ?? r.RepName),
    aliasname: toStr(r.aliasname ?? r.AliasName),
    billtodef: toStr(r.billtodef ?? r.BillToDef),
    u_delyn: toStr(r.u_delyn ?? r.U_Delyn),
  };
}

export function mapSapRowToItemlist(r: Record<string, unknown>): ItemlistRow {
  return {
    itemcode: String(r.itemcode ?? r.ItemCode ?? "").trim() || "",
    itemname: toStr(r.itemname ?? r.ItemName),
    itmsgrpcod: toNum(r.itmsgrpcod ?? r.ItmsGrpCod),
    codebars: toStr(r.codebars ?? r.CodeBars),
    brand: toStr(r.brand ?? r.Brand ?? r.U_LEVEL3NM ?? r.u_level3nm),
    itemgb: toStr(r.itemgb ?? r.Itemgb ?? r.U_LEVEL2 ?? r.u_level2),
  };
}

export function mapSapRowToSales(r: Record<string, unknown>, index: number): Omit<SalesRow, "id"> {
  const linestatus = toStr(r.linestatus ?? r.LineStatus) ?? "O";
  return {
    docentry: Number(r.docentry ?? r.DocEntry ?? 0),
    linenum: Number(r.linenum ?? r.LineNum ?? index),
    itemcode: toStr(r.itemcode ?? r.ItemCode),
    quantity: toNum(r.quantity ?? r.Quantity),
    price: toNum(r.price ?? r.Price),
    discprcnt: toNum(r.discprcnt ?? r.DiscPrcnt),
    pricebefdi: toNum(r.pricebefdi ?? r.PriceBefDi),
    docdate: toDate(r.docdate ?? r.DocDate),
    basecard: toStr(r.basecard ?? r.BaseCard),
    totalsumsy: toNum(r.totalsumsy ?? r.TotalSumSy),
    vatsumsy: toNum(r.vatsumsy ?? r.VatSumSy),
    linestatus: linestatus === "" ? "O" : linestatus,
  };
}

export function mapSapRowToInamt(r: Record<string, unknown>): InamtRow {
  return {
    docentry: Number(r.docentry ?? r.DocEntry ?? 0),
    docdate: toDate(r.docdate ?? r.DocDate),
    cardcode: toStr(r.cardcode ?? r.CardCode),
    doctotal: toNum(r.doctotal ?? r.DocTotal),
  };
}

export function mapSapRowToSaleetc(r: Record<string, unknown>, index: number): Omit<SaleetcRow, "id"> {
  return {
    docentry: Number(r.docentry ?? r.DocEntry ?? 0),
    linenum: Number(r.linenum ?? r.LineNum ?? index),
    itemcode: toStr(r.itemcode ?? r.ItemCode),
    quantity: toNum(r.quantity ?? r.Quantity),
    docdate: toDate(r.docdate ?? r.DocDate),
    basecard: toStr(r.basecard ?? r.BaseCard),
  };
}
