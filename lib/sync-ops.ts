/**
 * Supabase UPSERT 배치 처리.
 * SAP 원본 수정 없음. INSERT/UPDATE만 Supabase에 반영.
 */

import { getSupabaseAdmin } from "./supabase";
import { BATCH_SIZE } from "./constants";
import type { CustomerRow, ItemlistRow, SalesRow, InamtRow, SaleetcRow, OrdersRow } from "@/types/database";
import type { SyncResult } from "@/types/sync";

export async function upsertCustomerBatch(
  data: CustomerRow[],
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  let inserted = 0;
  let updated = 0;
  const total = data.length;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("customer")
      .upsert(chunk, { onConflict: "cardcode" })
      .select("cardcode");
    if (error) return { success: false, inserted, updated, error: error.message };
    const count = upserted?.length ?? 0;
    inserted += count;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated };
}

export async function upsertItemlistBatch(
  data: ItemlistRow[],
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  let inserted = 0;
  const total = data.length;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("itemlist")
      .upsert(chunk, { onConflict: "itemcode" })
      .select("itemcode");
    if (error) return { success: false, inserted, updated: 0, error: error.message };
    inserted += upserted?.length ?? 0;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated: 0 };
}

export async function upsertSalesBatch(
  data: Array<Omit<SalesRow, "id" | "linestatus"> & { linenum?: number; linestatus?: string | null }>,
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  const rows: Omit<SalesRow, "id">[] = data.map((r, idx) => ({
    docentry: r.docentry,
    linenum: r.linenum ?? idx % 100000,
    itemcode: r.itemcode ?? null,
    quantity: r.quantity ?? null,
    price: r.price ?? null,
    discprcnt: r.discprcnt ?? null,
    pricebefdi: r.pricebefdi ?? null,
    docdate: r.docdate ?? null,
    basecard: r.basecard ?? null,
    totalsumsy: r.totalsumsy ?? null,
    vatsumsy: r.vatsumsy ?? null,
    linestatus: r.linestatus ?? "O",
  }));
  let inserted = 0;
  const total = rows.length;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("sales")
      .upsert(chunk, { onConflict: "docentry,linenum" })
      .select("docentry");
    if (error) return { success: false, inserted, updated: 0, error: error.message };
    inserted += upserted?.length ?? 0;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated: 0 };
}

export async function upsertInamtBatch(
  data: InamtRow[],
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  let inserted = 0;
  const total = data.length;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("inamt")
      .upsert(chunk, { onConflict: "docentry" })
      .select("docentry");
    if (error) return { success: false, inserted, updated: 0, error: error.message };
    inserted += upserted?.length ?? 0;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated: 0 };
}

export async function upsertSaleetcBatch(
  data: Array<Omit<SaleetcRow, "id"> & { linenum?: number }>,
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  const rows: Omit<SaleetcRow, "id">[] = data.map((r, idx) => ({
    docentry: r.docentry,
    linenum: r.linenum ?? idx % 100000,
    itemcode: r.itemcode ?? null,
    quantity: r.quantity ?? null,
    docdate: r.docdate ?? null,
    basecard: r.basecard ?? null,
  }));
  let inserted = 0;
  const total = rows.length;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("saleetc")
      .upsert(chunk, { onConflict: "docentry,linenum" })
      .select("docentry");
    if (error) return { success: false, inserted, updated: 0, error: error.message };
    inserted += upserted?.length ?? 0;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated: 0 };
}

export async function upsertOrdersBatch(
  data: OrdersRow[],
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  let inserted = 0;
  const total = data.length;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const { data: upserted, error } = await admin
      .from("orders")
      .upsert(chunk, { onConflict: "docentry,linenum" })
      .select("docentry");
    if (error) return { success: false, inserted, updated: 0, error: error.message };
    inserted += upserted?.length ?? 0;
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }
  return { success: true, inserted, updated: 0 };
}

const DELETE_DOCENTRY_BATCH = 500;

/** Supabase orders에서 지정 (docentry, linenum) 행 삭제. docentry별 그룹화 후 배치 삭제 */
export async function deleteOrdersByKeys(
  keys: Array<{ docentry: number; linenum: number }>
): Promise<{ deleted: number; error?: string }> {
  if (keys.length === 0) return { deleted: 0 };
  const admin = getSupabaseAdmin();
  const byDoc: Map<number, number[]> = new Map();
  for (const { docentry, linenum } of keys) {
    const arr = byDoc.get(docentry) ?? [];
    arr.push(linenum);
    byDoc.set(docentry, arr);
  }
  let deleted = 0;
  for (const [docentry, linenums] of Array.from(byDoc.entries())) {
    const { data, error } = await admin
      .from("orders")
      .delete()
      .eq("docentry", docentry)
      .in("linenum", linenums)
      .select("docentry");
    if (error) return { deleted, error: error.message };
    deleted += data?.length ?? 0;
  }
  return { deleted };
}

/** Supabase orders에서 지정 docentry들의 모든 행 삭제 */
export async function deleteOrdersByDocentries(docentries: number[]): Promise<{ deleted: number; error?: string }> {
  if (docentries.length === 0) return { deleted: 0 };
  const admin = getSupabaseAdmin();
  let deleted = 0;
  for (let i = 0; i < docentries.length; i += DELETE_DOCENTRY_BATCH) {
    const chunk = docentries.slice(i, i + DELETE_DOCENTRY_BATCH);
    const { data, error } = await admin.from("orders").delete().in("docentry", chunk).select("docentry");
    if (error) return { deleted, error: error.message };
    deleted += data?.length ?? 0;
  }
  return { deleted };
}
