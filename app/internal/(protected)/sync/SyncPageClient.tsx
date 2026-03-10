"use client";

import { useState, useEffect } from "react";

export interface SyncMetadata {
  entity_type: string;
  last_synced_at: string;
  inserted_count: number;
  updated_count: number;
  total_count: number;
}

const SYNC_ITEMS = [
  { label: "거래처 동기화", path: "/api/sync/customer/run", entityType: "customer" },
  { label: "품목 동기화", path: "/api/sync/itemlist/run", entityType: "itemlist" },
  { label: "매출 동기화", path: "/api/sync/sales/run", entityType: "sales" },
  { label: "입금 동기화", path: "/api/sync/inamt/run", entityType: "inamt" },
  { label: "기타출고 동기화", path: "/api/sync/saleetc/run", entityType: "saleetc" },
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

/** 반영 건수: 마지막 동기화 당시 건수 (inserted + updated) */
function formatLastSyncCount(m: SyncMetadata | undefined): string {
  if (!m) return "-";
  const n = m.inserted_count + m.updated_count;
  return n.toLocaleString();
}

/** 합계 건수: 누적 데이터 건수 */
function formatTotalCount(count: number | undefined): string {
  if (count == null) return "-";
  return count.toLocaleString();
}

interface Props {
  initialMetadata: Record<string, SyncMetadata>;
  initialTableCounts: Record<string, number>;
}

interface MaintenanceForm {
  content: string;
  time_from: string;
  time_to: string;
}

export default function SyncPageClient({ initialMetadata, initialTableCounts }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [metadata, setMetadata] = useState<Record<string, SyncMetadata>>(initialMetadata);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>(initialTableCounts);
  const [maintenance, setMaintenance] = useState<MaintenanceForm>({ content: "", time_from: "", time_to: "" });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dailyAutoResults, setDailyAutoResults] = useState<{
    customer_count: number;
    itemlist_count: number;
    inamt_count: number;
    saleetc_count: number;
    sales_count: number;
    completed_at: string;
    status: string;
  } | null>(null);

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

  useEffect(() => {
    fetch("/api/sync/daily-auto-results")
      .then((res) => res.json())
      .then((json) => {
        if (json && typeof json === "object" && !json.error) {
          setDailyAutoResults(json);
        }
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

  const runSync = async (label: string, path: string, entityType: string, full: boolean) => {
    const loadingKey = full ? `${label}-full` : label;
    setLoading(loadingKey);
    setProgress(0);
    setResult((r) => ({ ...r, [label]: { ok: false, msg: "진행 중..." } }));
    try {
      const url = full ? `${path}${path.includes("?") ? "&" : "?"}full=1` : path;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.success;
      const inserted = data?.inserted ?? 0;
      const updated = data?.updated ?? 0;
      const lastSyncCount = inserted + updated;
      const msg = data?.error ?? (ok ? `반영 ${lastSyncCount.toLocaleString()}건` : `오류: ${res.status}`);
      setResult((r) => ({ ...r, [label]: { ok, msg } }));
      if (ok) {
        setMetadata((prev) => ({
          ...prev,
          [entityType]: {
            entity_type: entityType,
            last_synced_at: new Date().toISOString(),
            inserted_count: inserted,
            updated_count: updated,
            total_count: lastSyncCount,
          },
        }));
        const totalCount = data?.totalCount;
        if (typeof totalCount === "number") {
          setTableCounts((prev) => ({ ...prev, [entityType]: totalCount }));
        } else {
          try {
            const countsRes = await fetch("/api/sync/table-counts");
            const counts = await countsRes.json();
            if (countsRes.ok && typeof counts === "object" && counts !== null) {
              setTableCounts((prev) => ({ ...prev, ...counts }));
            }
          } catch {
            // 건수 조회 실패 시 기존 값 유지
          }
        }
      }
    } catch (e) {
      setResult((r) => ({ ...r, [label]: { ok: false, msg: String(e) } }));
    } finally {
      setProgress(100);
      setLoading(null);
    }
  };

  const isIncrementalLoading = (label: string) => loading === label;
  const isFullLoading = (label: string) => loading === `${label}-full`;
  const isAnyLoading = (label: string) => isIncrementalLoading(label) || isFullLoading(label);

  return (
    <div>
      {/* 동기화 */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-2">동기화</h2>
        <p className="text-gray-600 mb-4">
          (증분): 변경된 데이터만 반영. (전체): 전체 데이터 반영.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {SYNC_ITEMS.map(({ label, path, entityType }) => {
            const meta = metadata[entityType];
            return (
              <div
                key={label}
                className="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex gap-1 w-full">
                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => runSync(label, path, entityType, false)}
                    className="flex-1 min-w-0 px-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isIncrementalLoading(label) ? "처리 중..." : `${label.replace(" 동기화", "")} (증분)`}
                  </button>
                  <button
                    type="button"
                    disabled={loading !== null}
                    onClick={() => runSync(label, path, entityType, true)}
                    className="flex-1 min-w-0 px-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isFullLoading(label) ? "처리 중..." : "(전체)"}
                  </button>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-600">
                    마지막 동기화: {formatSyncDate(meta?.last_synced_at ?? null)}
                  </span>
                  {result[label] && !isAnyLoading(label) && (
                    <span className={`text-sm ${result[label].ok ? "text-green-600" : "text-red-600"}`}>
                      {result[label].msg}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-700">
                  반영 {formatLastSyncCount(meta)}건 / 합계 {formatTotalCount(tableCounts[entityType])}건
                </span>
              </div>
                {isAnyLoading(label) && (
                  <span className="text-sm text-gray-600">{progress}%</span>
                )}
            </div>
          );
        })}
          </div>
        </section>

        {/* 동기화 하단: 점검 정보 + 자동 동기화 결과 */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-gray-800 mb-2">점검 정보</h2>
          <p className="text-gray-600 mb-4">
            점검중 페이지에 표시할 내용과 기간을 입력하세요. 비워두면 점검 페이지에서 표시되지 않습니다.
          </p>
          <div className="flex flex-col lg:flex-row gap-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-w-2xl space-y-3 flex-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">점검 내용</label>
              <textarea
                value={maintenance.content}
                onChange={(e) => setMaintenance((m) => ({ ...m, content: e.target.value }))}
                rows={3}
                placeholder="예: 시스템 업그레이드 작업"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">점검 시작일시</label>
                <input
                  type="datetime-local"
                  value={maintenance.time_from}
                  onChange={(e) => setMaintenance((m) => ({ ...m, time_from: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">점검 종료일시</label>
                <input
                  type="datetime-local"
                  value={maintenance.time_to}
                  onChange={(e) => setMaintenance((m) => ({ ...m, time_to: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveMaintenance}
                disabled={maintenanceSaving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* 점검 정보 우측: 오늘 자동 동기화 결과 */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-w-md space-y-2">
            <h3 className="text-sm font-medium text-gray-700">오늘 자동 동기화 (매일 6시)</h3>
            {dailyAutoResults ? (
              <div className="space-y-1 text-sm text-gray-600">
                <div>거래처: {dailyAutoResults.customer_count.toLocaleString()}건</div>
                <div>품목: {dailyAutoResults.itemlist_count.toLocaleString()}건</div>
                <div>입금: {dailyAutoResults.inamt_count.toLocaleString()}건</div>
                <div>기타출고: {dailyAutoResults.saleetc_count.toLocaleString()}건</div>
                <div>매출: {dailyAutoResults.sales_count.toLocaleString()}건</div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatSyncDate(dailyAutoResults.completed_at)}
                  {dailyAutoResults.status !== "success" && (
                    <span className="text-amber-600 ml-1">({dailyAutoResults.status})</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">오늘 자동 동기화 없음</p>
            )}
          </div>
          </div>
        </section>
    </div>
  );
}
