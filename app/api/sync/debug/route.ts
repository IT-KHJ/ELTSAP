import { NextResponse } from "next/server";
import { getLastSyncTime } from "@/lib/sync-metadata";
import { isSapSqlServerConfigured } from "@/lib/sap-sqlserver";

/** GET: 증분 동기화 디버깅용. last_synced_at, sync_metadata 전체 확인 */
export async function GET() {
  try {
    const sapConfigured = isSapSqlServerConfigured();
    const lastSyncCustomer = await getLastSyncTime("customer");
    let allMetadata: unknown[] = [];
    let metadataError: string | null = null;
    try {
      const { getSupabaseAdmin } = await import("@/lib/supabase");
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.from("sync_metadata").select("*").order("entity_type");
      if (error) metadataError = error.message;
      else allMetadata = (data ?? []) as unknown[];
    } catch (e) {
      metadataError = e instanceof Error ? e.message : String(e);
    }
    return NextResponse.json({
      sapSqlServerConfigured: sapConfigured,
      customer: {
        last_synced_at: lastSyncCustomer ?? "(없음 - 전체 동기화 수행됨)",
        incrementalApplied: !!lastSyncCustomer,
      },
      sync_metadata_all: allMetadata,
      sync_metadata_error: metadataError,
      hint: !lastSyncCustomer
        ? "last_synced_at이 없으면 증분 조건이 적용되지 않습니다. sync_metadata에 customer 행이 있고 last_synced_at이 채워져 있는지 확인하세요."
        : "last_synced_at이 있으면 증분 조건이 적용됩니다.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "디버깅 중 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
