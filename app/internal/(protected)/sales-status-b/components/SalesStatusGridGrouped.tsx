"use client";

import { useState, Fragment, useCallback, useRef, useEffect } from "react";
import { formatAmount } from "@/lib/format";
import type { SalesStatusGroupedRow, SalesStatusDetailRow } from "@/lib/sales-status-grouped-queries";

const DETAIL_COLUMNS: {
  key: keyof SalesStatusDetailRow;
  label: string;
  align?: "right" | "left";
  minWidth?: string;
}[] = [
  { key: "docdate", label: "일자", align: "left", minWidth: "6rem" },
  { key: "itemcode", label: "품목번호", align: "left", minWidth: "6rem" },
  { key: "itemname", label: "품목명", align: "left", minWidth: "10rem" },
  { key: "price", label: "정가", align: "right", minWidth: "5rem" },
  { key: "supplyRate", label: "공급율", align: "right", minWidth: "4rem" },
  { key: "discountRate", label: "할인율", align: "right", minWidth: "4rem" },
  { key: "quantity", label: "매출수량", align: "right", minWidth: "5rem" },
  { key: "salesAmount", label: "매출액", align: "right", minWidth: "6rem" },
  { key: "vatAmount", label: "세액", align: "right", minWidth: "6rem" },
  { key: "totalAmount", label: "총금액", align: "right", minWidth: "6rem" },
  { key: "returnAmount", label: "반품액", align: "right", minWidth: "6rem" },
  { key: "netSales", label: "순매출", align: "right", minWidth: "6rem" },
];

const GROUPED_COL_COUNT = 9;

function formatDocdate(v: unknown): string {
  if (v == null || v === "") return "-";
  const s = String(v).replace(/-/g, "").replace(/\D/g, "");
  if (s.length >= 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return String(v);
}

function formatDetailCellValue(row: SalesStatusDetailRow, key: keyof SalesStatusDetailRow): string {
  const v = row[key];
  if (v == null) return "-";
  if (key === "docdate") return formatDocdate(v);
  if (typeof v === "number") {
    if (
      key === "price" ||
      key === "salesAmount" ||
      key === "vatAmount" ||
      key === "totalAmount" ||
      key === "returnAmount" ||
      key === "netSales"
    ) {
      return formatAmount(v);
    }
    return String(v);
  }
  return String(v);
}

interface SalesStatusGridGroupedProps {
  groupedRows: SalesStatusGroupedRow[];
  startDate: string;
  endDate: string;
  salesType: "all" | "sales" | "return";
}

export function SalesStatusGridGrouped({
  groupedRows,
  startDate,
  endDate,
  salesType,
}: SalesStatusGridGroupedProps) {
  const [expandedBasecard, setExpandedBasecard] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<Record<string, SalesStatusDetailRow[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const detailRowsRef = useRef<Record<string, SalesStatusDetailRow[]>>({});
  useEffect(() => {
    detailRowsRef.current = detailRows;
  }, [detailRows]);

  const fetchDetail = useCallback(
    async (basecard: string) => {
      if (detailRowsRef.current[basecard]) return;
      setDetailLoading((prev) => ({ ...prev, [basecard]: true }));
      try {
        const res = await fetch(
          `/api/sales-status-detail?start=${startDate}&end=${endDate}&cardcode=${encodeURIComponent(basecard)}&salesType=${salesType}`
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setDetailRows((prev) => ({ ...prev, [basecard]: data.rows ?? [] }));
      } catch {
        setDetailRows((prev) => ({ ...prev, [basecard]: [] }));
      } finally {
        setDetailLoading((prev) => ({ ...prev, [basecard]: false }));
      }
    },
    [startDate, endDate, salesType]
  );

  const toggleExpand = useCallback(
    (basecard: string) => {
      const next = expandedBasecard === basecard ? null : basecard;
      setExpandedBasecard(next);
      if (next) fetchDetail(next);
    },
    [expandedBasecard, fetchDetail]
  );

  if (groupedRows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th
              className="px-3 py-2 font-medium text-gray-700 text-left whitespace-nowrap"
              style={{ minWidth: "5rem" }}
            >
              액션
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-left whitespace-nowrap"
              style={{ minWidth: "6rem" }}
            >
              거래처코드
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-left whitespace-nowrap"
              style={{ minWidth: "8rem" }}
            >
              거래처명
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap"
              style={{ minWidth: "5rem" }}
            >
              매출수량
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap"
              style={{ minWidth: "6rem" }}
            >
              매출금액
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap"
              style={{ minWidth: "6rem" }}
            >
              세액
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap"
              style={{ minWidth: "6rem" }}
            >
              총금액
            </th>
            <th
              className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap"
              style={{ minWidth: "6rem" }}
            >
              반품금액
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.map((g) => {
            const isExpanded = expandedBasecard === g.basecard;
            const rows = detailRows[g.basecard] ?? [];
            const loading = detailLoading[g.basecard];
            return (
              <Fragment key={g.basecard}>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleExpand(g.basecard)}
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      {isExpanded ? "간략히보기" : "자세히보기"}
                    </button>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{g.basecard}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{g.cardname ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                    {formatAmount(g.quantity)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                    {formatAmount(g.salesAmount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                    {formatAmount(g.vatAmount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                    {formatAmount(g.totalAmount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                    {formatAmount(g.returnAmount)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={GROUPED_COL_COUNT} className="p-0 bg-gray-50">
                      <div className="px-4 py-3 border-t border-gray-200">
                        {loading ? (
                          <div className="py-4 text-center text-sm text-gray-500">로딩 중...</div>
                        ) : (
                          <table
                            className="w-full text-sm border-collapse"
                            style={{ minWidth: "max-content" }}
                          >
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                {DETAIL_COLUMNS.map(({ key, label, align, minWidth }) => (
                                  <th
                                    key={key}
                                    className={`px-3 py-2 font-medium text-gray-700 text-left whitespace-nowrap ${align === "right" ? "text-right" : ""}`}
                                    style={{ minWidth: minWidth ?? "auto" }}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => (
                                <tr
                                  key={`${row.docdate}-${row.itemcode}-${idx}`}
                                  className="border-b border-gray-100 hover:bg-gray-50"
                                >
                                  {DETAIL_COLUMNS.map(({ key, align, minWidth }) => (
                                    <td
                                      key={key}
                                      className={`px-3 py-2 whitespace-nowrap ${align === "right" ? "text-right tabular-nums" : ""}`}
                                      style={{ minWidth: minWidth ?? "auto" }}
                                    >
                                      {formatDetailCellValue(row, key)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
