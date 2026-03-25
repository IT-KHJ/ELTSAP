import { NextRequest, NextResponse } from "next/server";
import { deleteOrdersByDocentries, deleteOrdersByKeys, upsertOrdersBatch } from "@/lib/sync-ops";
import { getAllSyncMetadataWithError, getTableCount, lastSyncedAtRawToIncrementalSince, saveSyncMetadata } from "@/lib/sync-metadata";
import {
  isSapSqlServerConfigured,
  querySapOrders,
  querySapOrdersTouchedDocentries,
} from "@/lib/sap-sqlserver";
import { mapSapRowToOrders } from "@/lib/sap-mappers";
import { getSupabaseAdmin } from "@/lib/supabase";

function key(docentry: number, linenum: number): string {
  return `${docentry}:${linenum}`;
}

/** GET: SAP DLN1+ODLN 직접 조회 후 Supabase orders UPSERT. 증분 동기화 지원. ?full=1 시 전체 동기화. SAP 삭제 반영. */
export async function GET(request: NextRequest) {
  try {
    const fullSync = request.nextUrl.searchParams.get("full") === "1";
    if (!isSapSqlServerConfigured()) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보가 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    const metaResult = fullSync ? { data: [] } : await getAllSyncMetadataWithError();
    const allMeta = metaResult.data ?? [];
    const ordersMeta = allMeta.find((m) => m.entity_type === "orders");
    const raw = ordersMeta?.last_synced_at ?? null;
    let since: string | null = null;
    if (!fullSync && raw) {
      since = lastSyncedAtRawToIncrementalSince(raw);
    }

    let deletedCount = 0;

    if (fullSync || !since) {
      // 전체 동기화: SAP 현재 상태 vs Supabase 비교 후 삭제
      const rows = await querySapOrders(null);
      const sapKeys = new Set(rows.map((r) => key(Number(r.docentry), Number(r.linenum ?? 0))));

      const admin = getSupabaseAdmin();
      const supabaseKeys: Array<{ docentry: number; linenum: number }> = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await admin
          .from("orders")
          .select("docentry, linenum")
          .range(offset, offset + pageSize - 1);
        const batch = (data ?? []) as Array<{ docentry: number; linenum: number }>;
        if (batch.length === 0) break;
        supabaseKeys.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      const toDelete = supabaseKeys.filter((k) => !sapKeys.has(key(k.docentry, k.linenum)));
      if (toDelete.length > 0) {
        const del = await deleteOrdersByKeys(toDelete);
        if (del.error) {
          return NextResponse.json({ success: false, error: del.error }, { status: 500 });
        }
        deletedCount = del.deleted;
      }

      const mapped = rows.map((r, idx) => mapSapRowToOrders(r, idx));
      if (mapped.length === 0) {
        await saveSyncMetadata("orders", { inserted: 0, updated: 0 });
        const totalCount = await getTableCount("orders");
        return NextResponse.json({ success: true, inserted: 0, updated: 0, deletedCount, totalCount });
      }

      const result = await upsertOrdersBatch(mapped);
      if (result.success) {
        await saveSyncMetadata("orders", { inserted: result.inserted, updated: result.updated });
      }
      const totalCount = await getTableCount("orders");
      return NextResponse.json({ ...result, deletedCount, totalCount });
    }

    // 증분 동기화: touched docentries 삭제 후 upsert
    const [touchedDocentries, rows] = await Promise.all([
      querySapOrdersTouchedDocentries(since),
      querySapOrders(since),
    ]);

    if (touchedDocentries.length > 0) {
      const del = await deleteOrdersByDocentries(touchedDocentries);
      if (del.error) {
        return NextResponse.json({ success: false, error: del.error }, { status: 500 });
      }
      deletedCount = del.deleted;
    }

    const mapped = rows.map((r, idx) => mapSapRowToOrders(r, idx));
    if (mapped.length === 0) {
      await saveSyncMetadata("orders", { inserted: 0, updated: 0 });
      const totalCount = await getTableCount("orders");
      return NextResponse.json({ success: true, inserted: 0, updated: 0, deletedCount, totalCount });
    }

    const result = await upsertOrdersBatch(mapped);
    if (result.success) {
      await saveSyncMetadata("orders", { inserted: result.inserted, updated: result.updated });
    }
    const totalCount = await getTableCount("orders");
    return NextResponse.json({ ...result, deletedCount, totalCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
