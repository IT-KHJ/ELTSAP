import { NextRequest, NextResponse } from "next/server";
import { upsertSaleetcBatch } from "@/lib/sync-ops";
import { getAllSyncMetadataWithError, getTableCount, normalizeTimestampForParse, saveSyncMetadata } from "@/lib/sync-metadata";
import { isSapSqlServerConfigured, querySapSaleetc, querySapSaleetcDateRange } from "@/lib/sap-sqlserver";
import { mapSapRowToSaleetc } from "@/lib/sap-mappers";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_SALEETC_URL 사용. 증분 동기화 지원. ?full=1 시 전체 동기화. */
export async function GET(request: NextRequest) {
  try {
    const fullSync = request.nextUrl.searchParams.get("full") === "1";
    if (isSapSqlServerConfigured()) {
      const { data: allMeta, error: metaError } = fullSync ? { data: [], error: null } : await getAllSyncMetadataWithError();
      const saleetcMeta = allMeta.find((m) => m.entity_type === "saleetc");
      const raw = saleetcMeta?.last_synced_at ?? null;
      let since: string | null = null;
      let parseError: string | null = null;
      if (!fullSync && raw) {
        try {
          const normalized = normalizeTimestampForParse(raw);
          const d = new Date(normalized);
          if (!Number.isNaN(d.getTime())) since = d.toISOString().slice(0, 10);
          else parseError = `날짜 파싱 실패: ${raw}`;
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }
      }
      const [rows, sapDateRange] = await Promise.all([
        querySapSaleetc(since),
        querySapSaleetcDateRange(since),
      ]);
      const mapped = rows.map((r, idx) => mapSapRowToSaleetc(r, idx));
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
        await saveSyncMetadata("saleetc", { inserted: 0, updated: 0 });
        const totalCount = await getTableCount("saleetc");
        return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount, _debug });
      }
      const result = await upsertSaleetcBatch(mapped);
      if (result.success) {
        await saveSyncMetadata("saleetc", { inserted: result.inserted, updated: result.updated });
      }
      const totalCount = await getTableCount("saleetc");
      return NextResponse.json({ ...result, totalCount, _debug });
    }

    const url = process.env.SYNC_SALEETC_URL;
    if (!url) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보 또는 SYNC_SALEETC_URL이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`동기화 소스 오류: ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      await saveSyncMetadata("saleetc", { inserted: 0, updated: 0 });
      const totalCount = await getTableCount("saleetc");
      return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount });
    }
    const rows = (data as Record<string, unknown>[]).map((r, idx) => ({
      docentry: Number(r.docentry),
      linenum: Number(r.linenum ?? idx),
      itemcode: (r.itemcode as string) ?? null,
      quantity: (r.quantity as number) ?? null,
      docdate: (r.docdate as string) ?? null,
      basecard: (r.basecard as string) ?? null,
    }));
    const result = await upsertSaleetcBatch(rows);
    if (result.success) {
      await saveSyncMetadata("saleetc", { inserted: result.inserted, updated: result.updated });
    }
    const totalCount = await getTableCount("saleetc");
    return NextResponse.json({ ...result, totalCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
