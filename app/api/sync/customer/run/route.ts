import { NextRequest, NextResponse } from "next/server";
import { upsertCustomerBatch } from "@/lib/sync-ops";
import { getLastSyncTime, getLastSyncTimeDebug, getTableCount, saveSyncMetadata } from "@/lib/sync-metadata";
import { isSapSqlServerConfigured, querySapCustomer, querySapCustomerDateRange } from "@/lib/sap-sqlserver";
import { mapSapRowToCustomer } from "@/lib/sap-mappers";
import type { CustomerRow } from "@/types/database";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_CUSTOMER_URL 사용. 증분 동기화 지원. ?full=1 시 전체 동기화. */
export async function GET(request: NextRequest) {
  try {
    const fullSync = request.nextUrl.searchParams.get("full") === "1";
    if (isSapSqlServerConfigured()) {
      const lastSync = fullSync ? null : await getLastSyncTimeDebug("customer");
      const since = fullSync ? null : (lastSync && "since" in lastSync ? lastSync.since : null);
      const raw = lastSync && "raw" in lastSync ? lastSync.raw : null;
      const parseError = lastSync && "error" in lastSync ? lastSync.error : null;
      const [rows, sapDateRange] = await Promise.all([
        querySapCustomer(since),
        querySapCustomerDateRange(since),
      ]);
      const mapped: CustomerRow[] = rows.map((r) => mapSapRowToCustomer(r));
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? url.slice(0, 30);
      const _debug = {
        supabase: {
          raw: raw ?? null,
          since: since ?? null,
          error: parseError ?? null,
          projectRef,
          env: {
            url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            url_prefix: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").slice(0, 40),
            key_prefix: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")?.slice(0, 15),
          },
        },
        sap: sapDateRange,
      };
      if (mapped.length === 0) {
        await saveSyncMetadata("customer", { inserted: 0, updated: 0 });
        const totalCount = await getTableCount("customer");
        return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount, _debug });
      }
      const result = await upsertCustomerBatch(mapped);
      if (result.success) {
        await saveSyncMetadata("customer", { inserted: result.inserted, updated: result.updated });
      }
      const totalCount = await getTableCount("customer");
      return NextResponse.json({ ...result, totalCount, _debug });
    }

    const baseUrl = process.env.SYNC_CUSTOMER_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보 또는 SYNC_CUSTOMER_URL이 설정되지 않았습니다." },
        { status: 503 }
      );
    }
    const since = fullSync ? null : await getLastSyncTime("customer");
    const syncUrl = since ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}since=${since}` : baseUrl;
    const res = await fetch(syncUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`동기화 소스 오류: ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      await saveSyncMetadata("customer", { inserted: 0, updated: 0 });
      const totalCount = await getTableCount("customer");
      return NextResponse.json({ success: true, inserted: 0, updated: 0, totalCount });
    }
    const rows: CustomerRow[] = (data as Record<string, unknown>[]).map((r) => ({
      cardcode: String(r.cardcode ?? ""),
      cardname: (r.cardname as string) ?? null,
      groupcode: (r.groupcode as number) ?? null,
      address: (r.address as string) ?? null,
      zipcode: (r.zipcode as string) ?? null,
      phone1: (r.phone1 as string) ?? null,
      phone2: (r.phone2 as string) ?? null,
      fax: (r.fax as string) ?? null,
      cntctprsn: (r.cntctprsn as string) ?? null,
      notes: (r.notes as string) ?? null,
      e_mail: (r.e_mail as string) ?? null,
      shiptodef: (r.shiptodef as string) ?? null,
      vatregnum: (r.vatregnum as string) ?? null,
      repname: (r.repname as string) ?? null,
      aliasname: (r.aliasname as string) ?? null,
      billtodef: (r.billtodef as string) ?? null,
      u_delyn: (r.u_delyn as string) ?? null,
    }));
    const result = await upsertCustomerBatch(rows);
    if (result.success) {
      await saveSyncMetadata("customer", { inserted: result.inserted, updated: result.updated });
    }
    const totalCount = await getTableCount("customer");
    return NextResponse.json({ ...result, totalCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
