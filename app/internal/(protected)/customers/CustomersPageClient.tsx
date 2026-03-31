"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CustomerManageRow {
  cardcode: string;
  useyn: string | null;
  cardname: string | null;
  address: string | null;
  phone1: string | null;
  phone2: string | null;
  cntctprsn: string | null;
  repname: string | null;
  vatregnum: string | null;
  e_mail: string | null;
  fax: string | null;
}

type EditableField = Exclude<keyof CustomerManageRow, "cardcode">;

const EDITABLE_FIELDS: EditableField[] = [
  "useyn", "cardname", "address", "phone1", "phone2",
  "cntctprsn", "repname", "vatregnum", "e_mail", "fax",
];

const COLUMN_LABELS: Record<keyof CustomerManageRow, string> = {
  cardcode: "거래처코드",
  useyn: "사용",
  cardname: "거래처명",
  address: "주소",
  phone1: "전화1",
  phone2: "전화2",
  cntctprsn: "담당자",
  repname: "대표자",
  vatregnum: "사업자번호",
  e_mail: "이메일",
  fax: "팩스",
};

const COLUMN_ORDER: (keyof CustomerManageRow)[] = [
  "useyn", "cardname", "address", "phone1", "phone2",
  "cntctprsn", "repname", "vatregnum", "e_mail", "fax", "cardcode",
];

interface Props {
  initialRows: CustomerManageRow[];
}

export function CustomersPageClient({ initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerManageRow[]>(initialRows);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saveResults, setSaveResults] = useState<Record<string, "ok" | "error">>({});
  const [search, setSearch] = useState("");
  const [useynFilter, setUseynFilter] = useState<"" | "Y" | "N">("Y");

  // 메뉴 진입 시 서버 데이터 새로 조회
  useEffect(() => {
    router.refresh();
  }, [router]);

  // router.refresh() 후 서버 컴포넌트가 새 initialRows를 전달하면 state 동기화
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (useynFilter !== "" && (r.useyn ?? "Y") !== useynFilter) return false;
      if (!q) return true;
      return (
        (r.cardcode ?? "").toLowerCase().includes(q) ||
        (r.cardname ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, useynFilter]);

  const handleChange = useCallback(
    (cardcode: string, field: EditableField, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r.cardcode === cardcode ? { ...r, [field]: value } : r))
      );
      setDirty((prev) => {
        const next = new Set(prev);
        next.add(cardcode);
        return next;
      });
      setSaveResults((prev) => {
        const next = { ...prev };
        delete next[cardcode];
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(
    async (cardcode: string) => {
      const row = rows.find((r) => r.cardcode === cardcode);
      if (!row) return;

      setSaving((prev) => {
        const next = new Set(prev);
        next.add(cardcode);
        return next;
      });

      try {
        const body: Record<string, string | null> = { cardcode };
        for (const field of EDITABLE_FIELDS) {
          body[field] = row[field] ?? null;
        }
        const res = await fetch("/api/customers/manage", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());

        setDirty((prev) => {
          const next = new Set(prev);
          next.delete(cardcode);
          return next;
        });
        setSaveResults((prev) => ({ ...prev, [cardcode]: "ok" }));
        router.refresh();
      } catch {
        setSaveResults((prev) => ({ ...prev, [cardcode]: "error" }));
      } finally {
        setSaving((prev) => {
          const next = new Set(prev);
          next.delete(cardcode);
          return next;
        });
      }
    },
    [rows, router]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">거래처 관리</h1>
        <span className="text-sm text-gray-500">총 {rows.length}개 · 조회 {filteredRows.length}개</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={useynFilter}
          onChange={(e) => setUseynFilter(e.target.value as "" | "Y" | "N")}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">전체</option>
          <option value="Y">사용</option>
          <option value="N">중지</option>
        </select>
        <input
          type="text"
          placeholder="거래처명 또는 거래처코드 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
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
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-200">
                저장
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredRows.map((row) => {
              const isSaving = saving.has(row.cardcode);
              const isDirty = dirty.has(row.cardcode);
              const result = saveResults[row.cardcode];
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
                          className="border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={row[col as EditableField] ?? ""}
                          onChange={(e) => handleChange(row.cardcode, col as EditableField, e.target.value)}
                          disabled={isSaving}
                          className="w-full min-w-[80px] border border-gray-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSave(row.cardcode)}
                        disabled={!isDirty || isSaving}
                        className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSaving ? "저장 중…" : "저장"}
                      </button>
                      {result === "ok" && <span className="text-xs text-green-600">완료</span>}
                      {result === "error" && <span className="text-xs text-red-600">오류</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={COLUMN_ORDER.length + 1} className="px-4 py-8 text-center text-gray-400">
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
