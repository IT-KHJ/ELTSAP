import { NextResponse } from "next/server";
import { upsertSaleetcBatch } from "@/lib/sync-ops";
import { isSapSqlServerConfigured, querySapSaleetc } from "@/lib/sap-sqlserver";
import { mapSapRowToSaleetc } from "@/lib/sap-mappers";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_SALEETC_URL 사용. */
export async function GET() {
  try {
    if (isSapSqlServerConfigured()) {
      const rows = await querySapSaleetc();
      const mapped = rows.map((r, idx) => mapSapRowToSaleetc(r, idx));
      if (mapped.length === 0) {
        return NextResponse.json({ success: true, inserted: 0, updated: 0 });
      }
      const result = await upsertSaleetcBatch(mapped);
      return NextResponse.json(result);
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
      return NextResponse.json({ success: true, inserted: 0, updated: 0 });
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
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
