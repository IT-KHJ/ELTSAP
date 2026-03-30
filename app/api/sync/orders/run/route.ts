import { NextRequest, NextResponse } from "next/server";
import { upsertOrdersBatch } from "@/lib/sync-ops";
import { getAllSyncMetadataWithError, getTableCount, lastSyncedAtRawToIncrementalSince, saveSyncMetadata } from "@/lib/sync-metadata";
import { isSapSqlServerConfigured, querySapOrders } from "@/lib/sap-sqlserver";
import { mapSapRowToOrders } from "@/lib/sap-mappers";

/** GET: SAP DLN1+ODLN 직접 조회 후 Supabase orders UPSERT. 증분 동기화 지원. ?full=1 시 전체 동기화. */
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

    const rows = await querySapOrders(fullSync ? null : since);
    const mapped = rows.map((r, idx) => mapSapRowToOrders(r, idx));

    if (mapped.length === 0) {
      await saveSyncMetadata("orders", { inserted: 0, updated: 0 });
      const totalCount = await getTableCount("orders");
      return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount });
    }

    const result = await upsertOrdersBatch(mapped);
    if (result.success) {
      await saveSyncMetadata("orders", { inserted: result.inserted, updated: result.updated });
    }
    const totalCount = await getTableCount("orders");
    return NextResponse.json({ ...result, totalCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
