import { NextRequest, NextResponse } from "next/server";
import { upsertCustomerBatch } from "@/lib/sync-ops";
import type { SyncCustomerPayload } from "@/types/sync";
import type { CustomerRow } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncCustomerPayload;
    const data = body?.data;
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "data 배열이 필요합니다." },
        { status: 400 }
      );
    }
    const rows: CustomerRow[] = data.map((r) => ({
      cardcode: r.cardcode ?? "",
      cardname: r.cardname ?? null,
      groupcode: r.groupcode ?? null,
      address: r.address ?? null,
      zipcode: r.zipcode ?? null,
      phone1: r.phone1 ?? null,
      phone2: r.phone2 ?? null,
      fax: r.fax ?? null,
      cntctprsn: r.cntctprsn ?? null,
      notes: r.notes ?? null,
      e_mail: r.e_mail ?? null,
      shiptodef: r.shiptodef ?? null,
      vatregnum: r.vatregnum ?? null,
      repname: r.repname ?? null,
      aliasname: r.aliasname ?? null,
      billtodef: r.billtodef ?? null,
      u_delyn: r.u_delyn ?? null,
    }));
    const result = await upsertCustomerBatch(rows);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
