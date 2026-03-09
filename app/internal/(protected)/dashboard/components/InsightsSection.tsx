"use client";

import { formatAmount } from "@/lib/format";
import type { DashboardInsightsResponse } from "@/types/dashboard";

interface InsightsSectionProps {
  data: DashboardInsightsResponse;
  onCustomerClick?: (cardcode: string) => void;
}

export function InsightsSection({ data, onCustomerClick }: InsightsSectionProps) {
  const sections = [
    { title: "매출 급감 거래처", rows: data.salesDecline, emptyMsg: "해당 없음", isReturnRate: false },
    { title: "성장 거래처", rows: data.salesGrowth, emptyMsg: "해당 없음", isReturnRate: false },
    { title: "반품율 높은 거래처", rows: data.highReturnRate, emptyMsg: "해당 없음", isReturnRate: true },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">주요 인사이트</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((s) => (
          <div key={s.title} className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{s.title}</h3>
            {s.rows.length === 0 ? (
              <p className="text-sm text-gray-500">{s.emptyMsg}</p>
            ) : (
              <ul className="space-y-2">
                {s.rows.map((r) => {
                  const changePct = r.returnAmountChangePct ?? 0;
                  const changeStr =
                    changePct > 0 ? `+${changePct.toFixed(1)}%` : changePct < 0 ? `${changePct.toFixed(1)}%` : "-";
                  const changeColor = changePct > 0 ? "text-red-600" : changePct < 0 ? "text-blue-600" : "";
                  return (
                    <li key={r.cardcode} className="flex flex-col gap-1 text-sm py-2 border-b border-gray-100 last:border-0">
                      <button
                        type="button"
                        onClick={() => onCustomerClick?.(r.cardcode)}
                        className="text-blue-600 hover:underline text-left truncate w-full"
                        title={r.aliasname ?? r.cardcode}
                      >
                        {r.aliasname ?? r.cardcode}
                      </button>
                      <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-gray-600">
                        {s.isReturnRate && r.prevReturnAmount != null && r.currReturnAmount != null ? (
                          <>
                            <span>전년 반품 {formatAmount(r.prevReturnAmount)}</span>
                            <span>당해 반품 {formatAmount(r.currReturnAmount)}</span>
                            <span className={changeColor}>
                              {r.changeSymbol} {changeStr}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>전년 {formatAmount(r.prevYear)}</span>
                            <span>당해 {formatAmount(r.currYear)}</span>
                            <span className={r.changeSymbol === "▲" ? "text-red-600" : r.changeSymbol === "▼" ? "text-blue-600" : ""}>
                              {r.changeSymbol} {r.changePercent}
                            </span>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
