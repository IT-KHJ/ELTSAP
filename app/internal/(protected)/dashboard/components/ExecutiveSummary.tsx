"use client";

import { formatAmount } from "@/lib/format";
import type { DashboardSummary } from "@/types/dashboard";

interface ExecutiveSummaryProps {
  data: DashboardSummary;
}

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const isIncrease = data.yoyGrowth.startsWith("▲");
  const isDecrease = data.yoyGrowth.startsWith("▼");
  const yoyColor = isIncrease ? "text-red-600" : isDecrease ? "text-blue-600" : "text-gray-900";

  const cards = [
    { label: "거래처 수", value: data.activeCustomers.toLocaleString(), unit: "건", color: "" },
    { label: "총 매출", value: formatAmount(data.totalSales), unit: "원", color: "" },
    { label: "총 반품", value: formatAmount(data.totalReturns), unit: "원", color: "" },
    { label: "순매출", value: formatAmount(data.netSales), unit: "원", color: "" },
    { label: "상위 10 거래처 비중", value: `${data.top10Concentration.toFixed(1)}%`, unit: "", color: "" },
    { label: "전년 대비", value: data.yoyGrowth, unit: "", color: yoyColor },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-lg font-semibold ${c.color || "text-gray-900"}`}>
              {c.value}
              {c.unit && <span className="text-sm font-normal text-gray-600 ml-1">{c.unit}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
