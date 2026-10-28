import { getMirrorStatus, type MirrorStatus } from "@/lib/mirror-status";
import SyncPageClient from "./SyncPageClient";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  let mirrorStatus: MirrorStatus | null = null;
  try {
    mirrorStatus = await getMirrorStatus();
  } catch {
    // env 미설정 등으로 실패 시 상태 미표시
  }
  return <SyncPageClient mirrorStatus={mirrorStatus} />;
}
