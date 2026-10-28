/**
 * 설정 화면용 SAP 원본 미러(sap_*) 동기화 상태 조회. 읽기 전용.
 * 미러 동기화는 PC 작업 스케줄러(scripts/sap-mirror/sync.ts)가 실행하며, 이 화면은 결과만 표시한다.
 */

import { getSupabaseAdminNoCache } from "./supabase";

export interface MirrorRun {
  id: number;
  mode: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  message: string | null;
}

export interface MirrorReconMismatch {
  table_name: string;
  ym: string;
  sap_rows: number;
  mirror_rows: number;
  sap_sum: string | null;
  mirror_sum: string | null;
  checked_at: string;
}

export interface MirrorStatus {
  /** SAP 부하 감지로 정지된 상태 (수동 해제 전까지 동기화 거부) */
  halted: boolean;
  haltedAt: string | null;
  initialLoadedAt: string | null;
  /** 실행 종류별 마지막 실행 */
  lastByMode: Record<string, MirrorRun>;
  recentRuns: MirrorRun[];
  reconCheckedAt: string | null;
  reconMismatches: MirrorReconMismatch[];
}

const MODES = ["hourly", "daily", "weekly", "recon"] as const;
const RUN_COLUMNS = "id, mode, started_at, finished_at, status, message";

export async function getMirrorStatus(): Promise<MirrorStatus> {
  // 동기화 직후 값이 보여야 하므로 Next.js fetch 캐시를 쓰지 않는 클라이언트 사용
  const admin = getSupabaseAdminNoCache();

  const [stateRes, recentRes, reconRes, mismatchRes, ...modeRes] = await Promise.all([
    admin.from("sap_mirror_state").select("table_name, last_synced_at, initial_loaded_at").in("table_name", ["HALT", "INIT@all"]),
    admin.from("sap_mirror_runs").select(RUN_COLUMNS).order("id", { ascending: false }).limit(10),
    admin.from("sap_mirror_recon").select("checked_at").order("checked_at", { ascending: false }).limit(1),
    admin.from("sap_mirror_recon_mismatch").select("*").order("checked_at", { ascending: false }).limit(50),
    ...MODES.map((mode) =>
      admin.from("sap_mirror_runs").select(RUN_COLUMNS).eq("mode", mode).order("id", { ascending: false }).limit(1)
    ),
  ]);

  const stateRows = (stateRes.data ?? []) as Array<{ table_name: string; last_synced_at: string | null; initial_loaded_at: string | null }>;
  const halt = stateRows.find((r) => r.table_name === "HALT");
  const init = stateRows.find((r) => r.table_name === "INIT@all");

  const lastByMode: Record<string, MirrorRun> = {};
  MODES.forEach((mode, i) => {
    const row = ((modeRes[i]?.data ?? []) as MirrorRun[])[0];
    if (row) lastByMode[mode] = row;
  });

  return {
    halted: halt != null,
    haltedAt: halt?.last_synced_at ?? null,
    initialLoadedAt: init?.initial_loaded_at ?? init?.last_synced_at ?? null,
    lastByMode,
    recentRuns: (recentRes.data ?? []) as MirrorRun[],
    reconCheckedAt: ((reconRes.data ?? []) as Array<{ checked_at: string }>)[0]?.checked_at ?? null,
    reconMismatches: (mismatchRes.data ?? []) as MirrorReconMismatch[],
  };
}
