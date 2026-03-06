import { getAllSyncMetadata, getSyncTableCounts } from "@/lib/sync-metadata";
import SyncPageClient from "./SyncPageClient";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  let rows: Awaited<ReturnType<typeof getAllSyncMetadata>> = [];
  let tableCounts: Record<string, number> = {};
  try {
    [rows, tableCounts] = await Promise.all([getAllSyncMetadata(), getSyncTableCounts()]);
  } catch {
    // env 미설정 등으로 실패 시 빈 객체 전달
  }
  const initialMetadata: Record<string, { entity_type: string; last_synced_at: string; inserted_count: number; updated_count: number; total_count: number }> = {};
  for (const r of rows) {
    initialMetadata[r.entity_type] = r;
  }
  return <SyncPageClient initialMetadata={initialMetadata} initialTableCounts={tableCounts} />;
}
