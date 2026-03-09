"use client";

import { formatAmount } from "@/lib/format";
import type { ParetoRow } from "@/types/dashboard";

/** 1위 가장 진함, 순위 내려갈수록 연함 (10위까지만) */
function getBarColor(rank: number): string {
  if (rank > 10) return "rgb(191 219 254)";
  const step = (rank - 1) / 9;
  const r = Math.round(96 + step * 95);
  const g = Math.round(165 + step * 54);
  const b = Math.round(250 + step * 4);
  return `rgb(${r} ${g} ${b})`;
}

export function ParetoSection({ rows }: { rows: ParetoRow[] }) {
  const display = rows.slice(0, 10);
  const maxSales = Math.max(...display.map((r) => r.sales), 1);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">거래처 매출 집중도</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-2 min-w-[500px]">
            {display.map((r) => (
              <div key={r.cardcode} className="flex items-center gap-3">
                <div className="w-8 text-sm text-gray-600 shrink-0">{r.rank}</div>
                <div className="w-48 min-w-[12rem] shrink-0 overflow-hidden">
                  <span className="block text-sm truncate" title={r.aliasname ?? r.cardcode}>
                    {r.aliasname ?? r.cardcode}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1 items-center">
                    <div
                      className="h-6 rounded transition-all"
                      style={{
                        width: `${(r.sales / maxSales) * 100}%`,
                        minWidth: r.sales > 0 ? "4px" : "0",
                        backgroundColor: getBarColor(r.rank),
                      }}
                    />
                    <span className="text-xs text-gray-600 ml-1 shrink-0">
                      {formatAmount(r.sales)} ({r.cumulativePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
