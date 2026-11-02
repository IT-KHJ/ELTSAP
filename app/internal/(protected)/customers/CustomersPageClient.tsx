"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SIDO_LIST, SIGUN_BY_SIDO } from "@/lib/address-data";

interface CustomerManageRow {
  cardcode: string;
  useyn: string | null;
  sido: string | null;
  sigun: string | null;
  cardname: string | null;
  address: string | null;
  phone1: string | null;
  phone2: string | null;
  cntctprsn: string | null;
  repname: string | null;
}

/** 앱에서 관리하는 값만 수정 가능. 나머지(거래처명/주소/전화 등)는 SAP 값을 표시만 함 */
type EditableField = "useyn" | "sido" | "sigun";

const EDITABLE_FIELDS: EditableField[] = ["useyn", "sido", "sigun"];

const COLUMN_LABELS: Record<keyof CustomerManageRow, string> = {
  cardcode: "거래처코드",
  useyn: "사용",
  sido: "시/도",
  sigun: "시/군/구",
  cardname: "거래처명",
  address: "주소",
  phone1: "전화1",
  phone2: "전화2",
  cntctprsn: "담당자",
  repname: "대표자",
};

const COLUMN_ORDER: (keyof CustomerManageRow)[] = [
  "useyn", "sido", "sigun", "cardname", "address", "phone1", "phone2",
  "cntctprsn", "repname", "cardcode",
];

interface Props {
  initialRows: CustomerManageRow[];
}

export function CustomersPageClient({ initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerManageRow[]>(initialRows);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [useynFilter, setUseynFilter] = useState<"" | "Y" | "N">("Y");
  const [sidoFilter, setSidoFilter] = useState<string>("");
  const [sigunFilter, setSigunFilter] = useState<string>("");

  // router.refresh() 후 서버 컴포넌트가 새 initialRows를 전달하면 state 동기화
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  // 저장하지 않은 수정이 있으면 새로고침/창 닫기 시 브라우저 경고
  useEffect(() => {
    if (dirty.size === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (useynFilter !== "" && (r.useyn ?? "Y") !== useynFilter) return false;
      if (sidoFilter !== "" && r.sido !== sidoFilter) return false;
      if (sigunFilter !== "" && r.sigun !== sigunFilter) return false;
      if (!q) return true;
      return (
        (r.cardcode ?? "").toLowerCase().includes(q) ||
        (r.cardname ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, useynFilter, sidoFilter, sigunFilter]);

  const handleChange = useCallback(
    (cardcode: string, field: EditableField, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.cardcode !== cardcode) return r;
          // sido 변경 시 sigun 자동 초기화
          if (field === "sido") return { ...r, sido: value, sigun: null };
          return { ...r, [field]: value };
        })
      );
      setDirty((prev) => {
        const next = new Set(prev);
        next.add(cardcode);
        return next;
      });
      setSaveResult(null);
    },
    []
  );

  /** 수정된 행 전체를 한 번에 저장. 실패 시 화면의 수정값은 그대로 유지 */
  const handleSaveAll = useCallback(async () => {
    if (dirty.size === 0) return;
    const payload = rows
      .filter((r) => dirty.has(r.cardcode))
      .map((r) => {
        const item: Record<string, string | null> = { cardcode: r.cardcode };
        for (const field of EDITABLE_FIELDS) {
          item[field] = r[field] ?? null;
        }
        return item;
      });

    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/customers/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "저장 중 오류가 발생했습니다.");
      }

      setDirty(new Set());
      setSaveResult({ type: "ok", message: `${payload.length}건 저장 완료` });
      // 전부 저장된 경우에만 서버 값으로 다시 불러옴
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
      setSaveResult({ type: "error", message: `저장 실패: ${message}` });
    } finally {
      setSaving(false);
    }
  }, [dirty, rows, router]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">거래처 관리</h1>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={useynFilter}
          onChange={(e) => setUseynFilter(e.target.value as "" | "Y" | "N")}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">전체</option>
          <option value="Y">사용</option>
          <option value="N">중지</option>
        </select>
        <select
          value={sidoFilter}
          onChange={(e) => {
            setSidoFilter(e.target.value);
            setSigunFilter("");
          }}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">시/도 전체</option>
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sigunFilter}
          onChange={(e) => setSigunFilter(e.target.value)}
          disabled={sidoFilter === ""}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">시/군/구 전체</option>
          {(sidoFilter ? SIGUN_BY_SIDO[sidoFilter] ?? [] : []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="거래처명 또는 거래처코드 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">총 {rows.length}개 · 조회 {filteredRows.length}개</span>
          {dirty.size > 0 && <span className="text-sm text-amber-600">수정 {dirty.size}건</span>}
          {saveResult && (
            <span className={`text-sm ${saveResult.type === "ok" ? "text-green-600" : "text-red-600"}`}>
              {saveResult.message}
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={dirty.size === 0 || saving}
            className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      {/* 표 영역 높이를 화면에 맞춰 제한 → 좌우 스크롤바가 항상 보이고 헤더가 고정됨 */}
      <div className="overflow-auto max-h-[calc(100vh-11rem)] border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMN_ORDER.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-200"
                >
                  {COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredRows.map((row) => {
              const isSaving = saving;
              const isDirty = dirty.has(row.cardcode);
              const sigunOptions = SIGUN_BY_SIDO[row.sido ?? ""] ?? [];
              return (
                <tr
                  key={row.cardcode}
                  className={isDirty ? "bg-yellow-50" : "hover:bg-gray-50"}
                >
                  {COLUMN_ORDER.map((col) => (
                    <td key={col} className="px-2 py-1 whitespace-nowrap">
                      {col === "cardcode" ? (
                        <span className="text-gray-500 font-mono text-xs">{row.cardcode}</span>
                      ) : col === "useyn" ? (
                        <select
                          value={row.useyn ?? "Y"}
                          onChange={(e) => handleChange(row.cardcode, "useyn", e.target.value)}
                          disabled={isSaving}
                          className="border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      ) : col === "sido" ? (
                        <select
                          value={row.sido ?? ""}
                          onChange={(e) => handleChange(row.cardcode, "sido", e.target.value)}
                          disabled={isSaving}
                          className="border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-w-[110px]"
                        >
                          <option value="">(없음)</option>
                          {SIDO_LIST.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : col === "sigun" ? (
                        <select
                          value={row.sigun ?? ""}
                          onChange={(e) => handleChange(row.cardcode, "sigun", e.target.value)}
                          disabled={isSaving || sigunOptions.length === 0}
                          className="border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 min-w-[80px]"
                        >
                          <option value="">(없음)</option>
                          {sigunOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700">{row[col] ?? ""}</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={COLUMN_ORDER.length} className="px-4 py-8 text-center text-gray-400">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
