import { NextResponse } from "next/server";
import { upsertItemlistBatch } from "@/lib/sync-ops";
import { isSapSqlServerConfigured, querySapItemlist } from "@/lib/sap-sqlserver";
import { mapSapRowToItemlist } from "@/lib/sap-mappers";
import type { ItemlistRow } from "@/types/database";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_ITEMLIST_URL 사용. */
export async function GET() {
  try {
    if (isSapSqlServerConfigured()) {
      const rows = await querySapItemlist();
      const mapped: ItemlistRow[] = rows.map((r) => mapSapRowToItemlist(r));
      if (mapped.length === 0) {
        return NextResponse.json({ success: true, inserted: 0, updated: 0 });
      }
      const result = await upsertItemlistBatch(mapped);
      return NextResponse.json(result);
    }

    const url = process.env.SYNC_ITEMLIST_URL;
    if (!url) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보 또는 SYNC_ITEMLIST_URL이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`동기화 소스 오류: ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, updated: 0 });
    }
    const rows: ItemlistRow[] = (data as Record<string, unknown>[]).map((r) => ({
      itemcode: String(r.itemcode ?? ""),
      itemname: (r.itemname as string) ?? null,
      itmsgrpcod: (r.itmsgrpcod as number) ?? null,
      codebars: (r.codebars as string) ?? null,
      brand: (r.brand as string) ?? null,
      itemgb: (r.itemgb as string) ?? null,
    }));
    const result = await upsertItemlistBatch(rows);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
