import { NextRequest, NextResponse } from "next/server";
import { upsertInamtBatch } from "@/lib/sync-ops";
import { getAllSyncMetadataWithError, getTableCount, lastSyncedAtRawToIncrementalSince, saveSyncMetadata } from "@/lib/sync-metadata";
import { isSapSqlServerConfigured, querySapInamt, querySapInamtDateRange } from "@/lib/sap-sqlserver";
import { mapSapRowToInamt } from "@/lib/sap-mappers";
import type { InamtRow } from "@/types/database";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_INAMT_URL 사용. 증분 동기화 지원. ?full=1 시 전체 동기화. */
export async function GET(request: NextRequest) {
  try {
    const fullSync = request.nextUrl.searchParams.get("full") === "1";
    if (isSapSqlServerConfigured()) {
      const { data: allMeta, error: metaError } = fullSync ? { data: [], error: null } : await getAllSyncMetadataWithError();
      const inamtMeta = allMeta.find((m) => m.entity_type === "inamt");
      const raw = inamtMeta?.last_synced_at ?? null;
      let since: string | null = null;
      let parseError: string | null = null;
      if (!fullSync && raw) {
        since = lastSyncedAtRawToIncrementalSince(raw);
        if (since === null) parseError = `날짜 파싱 실패: ${raw}`;
      }
      const [rows, sapDateRange] = await Promise.all([
        querySapInamt(since),
        querySapInamtDateRange(since),
      ]);
      const mapped: InamtRow[] = rows.map((r) => mapSapRowToInamt(r));
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? url.slice(0, 30);
      const _debug = {
        supabase: {
          raw,
          since: since ?? null,
          error: metaError ?? parseError,
          metaRowCount: allMeta.length,
          metaEntityTypes: allMeta.map((m) => m.entity_type),
          metaRaw: Object.fromEntries(allMeta.map((m) => [m.entity_type, m.last_synced_at])),
          projectRef,
          env: {
            url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")?.slice(0, 15),
          },
        },
        sap: sapDateRange,
      };
      if (mapped.length === 0) {
        await saveSyncMetadata("inamt", { inserted: 0, updated: 0 });
        const totalCount = await getTableCount("inamt");
        return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount, _debug });
      }
      const result = await upsertInamtBatch(mapped);
      if (result.success) {
        await saveSyncMetadata("inamt", { inserted: result.inserted, updated: result.updated });
      }
      const totalCount = await getTableCount("inamt");
      return NextResponse.json({ ...result, totalCount, _debug });
    }

    const url = process.env.SYNC_INAMT_URL;
    if (!url) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보 또는 SYNC_INAMT_URL이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`동기화 소스 오류: ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      await saveSyncMetadata("inamt", { inserted: 0, updated: 0 });
      const totalCount = await getTableCount("inamt");
      return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount });
    }
    const rows: InamtRow[] = (data as Record<string, unknown>[]).map((r) => ({
      docentry: Number(r.docentry),
      docdate: (r.docdate as string) ?? null,
      cardcode: (r.cardcode as string) ?? null,
      doctotal: (r.doctotal as number) ?? null,
    }));
    const result = await upsertInamtBatch(rows);
    if (result.success) {
      await saveSyncMetadata("inamt", { inserted: result.inserted, updated: result.updated });
    }
    const totalCount = await getTableCount("inamt");
    return NextResponse.json({ ...result, totalCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
