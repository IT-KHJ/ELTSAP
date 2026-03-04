import { NextResponse } from "next/server";
import { upsertCustomerBatch } from "@/lib/sync-ops";
import { isSapSqlServerConfigured, querySapCustomer } from "@/lib/sap-sqlserver";
import { mapSapRowToCustomer } from "@/lib/sap-mappers";
import type { CustomerRow } from "@/types/database";

/** GET: SAP SQL Server 직접 조회 후 Supabase UPSERT. 미설정 시 SYNC_CUSTOMER_URL 사용. */
export async function GET() {
  try {
    if (isSapSqlServerConfigured()) {
      const rows = await querySapCustomer();
      const mapped: CustomerRow[] = rows.map((r) => mapSapRowToCustomer(r));
      if (mapped.length === 0) {
        return NextResponse.json({ success: true, inserted: 0, updated: 0 });
      }
      const result = await upsertCustomerBatch(mapped);
      return NextResponse.json(result);
    }

    const url = process.env.SYNC_CUSTOMER_URL;
    if (!url) {
      return NextResponse.json(
        { success: false, error: "SAP SQL Server 연결 정보 또는 SYNC_CUSTOMER_URL이 설정되지 않았습니다." },
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
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
