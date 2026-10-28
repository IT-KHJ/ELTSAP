"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MirrorStatus, MirrorRun } from "@/lib/mirror-status";

const MODE_ITEMS = [
  { mode: "hourly", label: "매시간", schedule: "평일 10:10~18:10, 1시간 간격" },
  { mode: "daily", label: "매일", schedule: "평일 12:30 (마스터 변경분·최근 대사 포함)" },
  { mode: "weekly", label: "매주", schedule: "금요일 16:30 (전체 점검)" },
  { mode: "recon", label: "대사", schedule: "매일/매주 실행에 포함, 전체 기간은 수동" },
] as const;

function formatSyncDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "success":
      return "성공";
    case "running":
      return "실행 중";
    case "failed":
      return "실패";
    case "sap_unavailable":
      return "SAP 접속 불가";
    case "sap_overload":
      return "SAP 부하 감지(정지)";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  if (status === "success") return "text-green-600";
  if (status === "running") return "text-blue-600";
  if (status === "sap_unavailable") return "text-amber-600";
  return "text-red-600";
}

function modeLabel(mode: string): string {
  return MODE_ITEMS.find((m) => m.mode === mode)?.label ?? mode;
}

interface Props {
  mirrorStatus: MirrorStatus | null;
}

interface MaintenanceForm {
  content: string;
  time_from: string;
  time_to: string;
}

export default function SyncPageClient({ mirrorStatus }: Props) {
  const router = useRouter();
  const [maintenance, setMaintenance] = useState<MaintenanceForm>({ content: "", time_from: "", time_to: "" });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  function toDatetimeLocal(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  useEffect(() => {
    fetch("/api/maintenance")
      .then((res) => res.json())
      .then((json) => {
        setMaintenance({
          content: json.content ?? "",
          time_from: toDatetimeLocal(json.time_from),
          time_to: toDatetimeLocal(json.time_to),
        });
      })
      .catch(() => {});
  }, []);

  const saveMaintenance = async () => {
    setMaintenanceSaving(true);
    setMaintenanceMsg(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: maintenance.content.trim() || null,
          time_from: maintenance.time_from ? new Date(maintenance.time_from).toISOString() : null,
          time_to: maintenance.time_to ? new Date(maintenance.time_to).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.success;
      setMaintenanceMsg({ ok, msg: ok ? "저장되었습니다." : (data?.error ?? `오류: ${res.status}`) });
    } catch (e) {
      setMaintenanceMsg({ ok: false, msg: String(e) });
    } finally {
      setMaintenanceSaving(false);
    }
  };

  return (
    <div>
      {/* SAP 미러 동기화 상태 (조회 전용) */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-base font-semibold text-gray-800">SAP 동기화 상태</h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            새로고침
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          SAP 원본 데이터는 PC 작업 스케줄러가 자동으로 동기화합니다. 이 화면은 실행 결과만 표시합니다.
          {mirrorStatus?.initialLoadedAt && (
            <span className="text-gray-500"> (초기 적재: {formatSyncDate(mirrorStatus.initialLoadedAt)})</span>
          )}
        </p>

        {!mirrorStatus ? (
          <p className="text-sm text-red-600">동기화 상태를 불러오지 못했습니다.</p>
        ) : (
          <>
            {mirrorStatus.halted && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                SAP 부하가 감지되어 동기화가 정지된 상태입니다({formatSyncDate(mirrorStatus.haltedAt)}). 원인 확인 후
                PC에서 <code className="px-1 bg-white rounded">npx tsx scripts/sap-mirror/sync.ts --clear-halt</code>로
                해제해야 다시 실행됩니다.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {MODE_ITEMS.map(({ mode, label, schedule }) => {
                const run: MirrorRun | undefined = mirrorStatus.lastByMode[mode];
                return (
                  <div key={mode} className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200 min-w-0">
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                    <span className="text-xs text-gray-500">{schedule}</span>
                    <span className="text-sm text-gray-600 mt-1">마지막 실행: {formatSyncDate(run?.started_at ?? null)}</span>
                    {run && <span className={`text-sm ${statusClass(run.status)}`}>{statusLabel(run.status)}</span>}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full mt-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">최근 실행 이력</h3>
                {mirrorStatus.recentRuns.length > 0 ? (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">시작 시각</th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">종류</th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">상태</th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mirrorStatus.recentRuns.map((run) => (
                        <tr key={run.id} className="border-b border-gray-100 align-top">
                          <td className="py-1.5 px-2 text-gray-700 whitespace-nowrap text-xs">{formatSyncDate(run.started_at)}</td>
                          <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{modeLabel(run.mode)}</td>
                          <td className={`py-1.5 px-2 whitespace-nowrap ${statusClass(run.status)}`}>{statusLabel(run.status)}</td>
                          <td className="py-1.5 px-2 text-gray-600 text-xs break-all">{run.message ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-500">이력 없음</p>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 mb-1">SAP 대사 결과</h3>
                <p className="text-xs text-gray-500 mb-3">
                  월별 건수·금액을 SAP와 비교합니다. 마지막 대사: {formatSyncDate(mirrorStatus.reconCheckedAt)}
                </p>
                {mirrorStatus.reconMismatches.length === 0 ? (
                  <p className="text-sm text-green-600">불일치 없음</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">테이블</th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">월</th>
                        <th className="text-right py-1.5 px-2 font-medium text-gray-600">SAP 건수</th>
                        <th className="text-right py-1.5 px-2 font-medium text-gray-600">미러 건수</th>
                        <th className="text-left py-1.5 px-2 font-medium text-gray-600">확인 시각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mirrorStatus.reconMismatches.map((r) => (
                        <tr key={`${r.table_name}-${r.ym}`} className="border-b border-gray-100">
                          <td className="py-1.5 px-2 text-gray-700">{r.table_name}</td>
                          <td className="py-1.5 px-2 text-gray-600">{r.ym}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{Number(r.sap_rows).toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-red-600">{Number(r.mirror_rows).toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap text-xs">{formatSyncDate(r.checked_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 점검 정보: 페이지 하단 */}
      <section className="mt-10 pt-8 border-t border-gray-200">
        <h2 className="text-base font-semibold text-gray-800 mb-2">점검 정보</h2>
        <p className="text-gray-600 mb-4">
          점검중 페이지에 표시할 내용과 기간을 입력하세요. 비워두면 점검 페이지에서 표시되지 않습니다.
        </p>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-w-2xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">점검 내용</label>
            <textarea
              value={maintenance.content}
              onChange={(e) => setMaintenance((m) => ({ ...m, content: e.target.value }))}
              rows={3}
              placeholder="예: 시스템 업그레이드 작업"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">점검 시작일시</label>
              <input
                type="datetime-local"
                value={maintenance.time_from}
                onChange={(e) => setMaintenance((m) => ({ ...m, time_from: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">점검 종료일시</label>
              <input
                type="datetime-local"
                value={maintenance.time_to}
                onChange={(e) => setMaintenance((m) => ({ ...m, time_to: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveMaintenance}
              disabled={maintenanceSaving}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {maintenanceSaving ? "저장 중..." : "저장"}
            </button>
            {maintenanceMsg && (
              <span className={`text-sm ${maintenanceMsg.ok ? "text-green-600" : "text-red-600"}`}>
                {maintenanceMsg.msg}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
