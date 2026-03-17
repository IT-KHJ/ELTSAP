"use client";

import { useState, useCallback, useMemo } from "react";
import { useModal } from "@/lib/components/ModalProvider";
import { SalesStatusFilterB, type SalesType } from "./components/SalesStatusFilterB";
import { SalesStatusGridGrouped } from "./components/SalesStatusGridGrouped";
import { formatAmount } from "@/lib/format";
import type { SalesStatusGroupedRow } from "@/lib/sales-status-grouped-queries";

function getDefaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end };
}

function computeSummary(rows: SalesStatusGroupedRow[]) {
  const totalSales = rows.reduce((s, r) => s + r.salesAmount + r.returnAmount, 0);
  const totalReturns = rows.reduce((s, r) => s + r.returnAmount, 0);
  const netSales = rows.reduce((s, r) => s + r.salesAmount, 0);
  return { totalSales, totalReturns, netSales };
}

export default function SalesStatusPageB() {
  const modal = useModal();
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [salesType, setSalesType] = useState<SalesType>("all");
  const [groupedRows, setGroupedRows] = useState<SalesStatusGroupedRow[]>([]);
  const [sapFetchFailed, setSapFetchFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sales-status-grouped?start=${startDate}&end=${endDate}&salesType=${salesType}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGroupedRows(data.rows ?? []);
      setSapFetchFailed(data.sapFetchFailed === true);
    } catch (e) {
      setGroupedRows([]);
      setSapFetchFailed(false);
      const msg = e instanceof Error ? e.message : "조회 실패";
      modal.open({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, salesType, modal]);

  const summary = groupedRows.length > 0 ? computeSummary(groupedRows) : null;

  return (
    <div className="sales-status-page">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">거래처 현황(판매집계)</h1>

      <div className="mb-4">
        <SalesStatusFilterB
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          salesType={salesType}
          onSalesTypeChange={setSalesType}
          onLoad={loadData}
          loading={loading}
        />
      </div>

      {sapFetchFailed && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <span className="text-lg" aria-hidden>
            ⚠️
          </span>
          <p className="text-sm">
            SAP 연결에 실패하여 실시간 배송 데이터를 불러오지 못했습니다. Supabase(마감) 데이터만 표시됩니다.
          </p>
        </div>
      )}

      {summary && (
        <div className="mb-4 flex gap-10 px-5 py-3 bg-blue-50 border border-blue-100 rounded-lg">
          <div>
            <span className="text-sm text-gray-600">총 매출</span>
            <span className="ml-2 font-bold">{formatAmount(summary.totalSales)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">총 반품</span>
            <span className="ml-2 font-bold">{formatAmount(summary.totalReturns)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">순매출</span>
            <span className="ml-2 font-bold">{formatAmount(summary.netSales)}</span>
          </div>
        </div>
      )}

      <SalesStatusGridGrouped
        groupedRows={groupedRows}
        startDate={startDate}
        endDate={endDate}
        salesType={salesType}
      />
    </div>
  );
}
