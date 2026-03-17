"use client";

import { useRef, useEffect } from "react";
import { formatAmount } from "@/lib/format";
import type { SalesStatusRow } from "@/types/sales-status";

interface SalesStatusGridProps {
  rows: SalesStatusRow[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

const COLUMNS: { key: keyof SalesStatusRow; label: string; align?: "right" | "left"; minWidth?: string }[] = [
  { key: "docdate", label: "일자", align: "left", minWidth: "6rem" },
  { key: "basecard", label: "거래처코드", align: "left", minWidth: "6rem" },
  { key: "cardname", label: "거래처명", align: "left", minWidth: "8rem" },
  { key: "itemcode", label: "품목번호", align: "left", minWidth: "6rem" },
  { key: "itemname", label: "품목명", align: "left", minWidth: "10rem" },
  { key: "price", label: "정가", align: "right", minWidth: "5rem" },
  { key: "supplyRate", label: "공급율", align: "right", minWidth: "4rem" },
  { key: "discountRate", label: "할인율", align: "right", minWidth: "4rem" },
  { key: "quantity", label: "매출수량", align: "right", minWidth: "5rem" },
  { key: "salesAmount", label: "매출액", align: "right", minWidth: "6rem" },
  { key: "returnAmount", label: "반품액", align: "right", minWidth: "6rem" },
  { key: "netSales", label: "순매출", align: "right", minWidth: "6rem" },
];

/** YYYY-MM-DD 포맷으로 통일 */
function formatDocdate(v: unknown): string {
  if (v == null || v === "") return "-";
  const s = String(v).replace(/-/g, "").replace(/\D/g, "");
  if (s.length >= 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return String(v);
}

function formatCellValue(row: SalesStatusRow, key: keyof SalesStatusRow): string {
  const v = row[key];
  if (v == null) return "-";
  if (key === "docdate") return formatDocdate(v);
  if (typeof v === "number") {
    if (key === "price" || key === "salesAmount" || key === "returnAmount" || key === "netSales") {
      return formatAmount(v);
    }
    return String(v);
  }
  return String(v);
}

export function SalesStatusGrid({ rows, hasMore, loading, onLoadMore }: SalesStatusGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "100px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (rows.length === 0 && !loading) {
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
            {COLUMNS.map(({ key, label, align, minWidth }) => (
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
              key={`${row.docdate}-${row.basecard}-${row.itemcode}-${idx}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              {COLUMNS.map(({ key, align, minWidth }) => (
                <td
                  key={key}
                  className={`px-3 py-2 whitespace-nowrap ${align === "right" ? "text-right tabular-nums" : ""}`}
                  style={{ minWidth: minWidth ?? "auto" }}
                >
                  {formatCellValue(row, key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={sentinelRef} className="h-4 flex items-center justify-center">
        {loading && <span className="text-sm text-gray-500">로딩 중...</span>}
        {hasMore && !loading && <span className="text-sm text-gray-400">스크롤하여 더 보기</span>}
      </div>
    </div>
  );
}
