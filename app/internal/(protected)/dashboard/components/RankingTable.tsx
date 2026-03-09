"use client";

import { formatAmount } from "@/lib/format";
import type { CustomerRankingRow } from "@/types/dashboard";

interface RankingTableProps {
  rows: CustomerRankingRow[];
  totalCount: number;
  page: number;
  limit: number;
  sortBy: string;
  order: "asc" | "desc";
  onSort: (col: string) => void;
  onPageChange: (page: number) => void;
  onRowClick: (row: CustomerRankingRow) => void;
}

export function RankingTable({
  rows,
  totalCount,
  page,
  limit,
  sortBy,
  order,
  onSort,
  onPageChange,
  onRowClick,
}: RankingTableProps) {
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th
      className="report-th py-2 px-3 cursor-pointer hover:bg-gray-100 text-center whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      {label}
      {sortBy === col && <span className="ml-1">{order === "desc" ? "▼" : "▲"}</span>}
    </th>
  );

  const displayName = (r: CustomerRankingRow) => r.aliasname || r.cardname || r.cardcode;

  /** 1~5위만 배경색, 6위~ 없음 */
  const getRowBg = (rank: number) => {
    if (rank > 5) return "";
    if (rank === 1) return "bg-blue-400/30";
    if (rank === 2) return "bg-blue-400/25";
    if (rank === 3) return "bg-blue-400/20";
    if (rank === 4) return "bg-blue-400/16";
    return "bg-blue-400/12";
  };

  const cellCenter = "report-td py-2 px-3 text-center";

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">거래처 매출 Ranking</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="report-table w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr>
              <SortHeader col="rank" label="순위" />
              <SortHeader col="cardname" label="거래처" />
              <SortHeader col="sales" label="매출" />
              <SortHeader col="netSales" label="순매출" />
              <SortHeader col="returns" label="반품액" />
              <SortHeader col="returnRate" label="반품률" />
              <SortHeader col="sharePercent" label="비중" />
              <SortHeader col="yoy" label="전년대비" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="report-td py-8 text-center text-gray-500">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const bg = getRowBg(r.rank);
                return (
                  <tr
                    key={r.cardcode}
                    className={`hover:bg-gray-50 cursor-pointer ${bg}`}
                    onClick={() => onRowClick(r)}
                  >
                    <td className={cellCenter}>{r.rank}</td>
                    <td className="report-td py-2 px-3 min-w-0 text-left">
                      <span className="block truncate" title={`${r.cardcode} ${displayName(r)}`}>
                        <span className="font-medium text-gray-700">{r.cardcode}</span>
                        <span className="text-gray-600 ml-1">{displayName(r)}</span>
                      </span>
                    </td>
                    <td className={`report-td-num ${cellCenter}`}>{formatAmount(r.sales)}</td>
                    <td className={`report-td-num ${cellCenter}`}>{formatAmount(r.netSales)}</td>
                    <td className={`report-td-num ${cellCenter}`}>{formatAmount(r.returns)}</td>
                    <td className={`report-td-num ${cellCenter}`}>{r.returnRate.toFixed(1)}%</td>
                    <td className={`report-td-num ${cellCenter}`}>{r.sharePercent.toFixed(1)}%</td>
                    <td className={cellCenter}>
                      <span className={r.yoy.startsWith("-") ? "text-blue-600" : r.yoy !== "-" ? "text-red-600" : ""}>
                        {r.yoy}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {totalCount > limit && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            총 {totalCount}건 ({(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)})
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
