"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useModal } from "@/lib/components/ModalProvider";
import { SalesStatusFilterB, type SalesType } from "./components/SalesStatusFilterB";
import { SalesStatusGridGrouped } from "./components/SalesStatusGridGrouped";
import { formatAmount } from "@/lib/format";
import type { SalesStatusGroupedRow, SalesStatusDetailRow } from "@/lib/sales-status-grouped-queries";
import { buildSalesStatusGroupedExcel } from "@/lib/sales-status-grouped-excel";

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

  const [expandedBasecards, setExpandedBasecards] = useState<Set<string>>(() => new Set());
  const [detailRows, setDetailRows] = useState<Record<string, SalesStatusDetailRow[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const detailRowsRef = useRef<Record<string, SalesStatusDetailRow[]>>({});
  useEffect(() => {
    detailRowsRef.current = detailRows;
  }, [detailRows]);

  const fetchDetail = useCallback(
    async (basecard: string) => {
      if (Object.prototype.hasOwnProperty.call(detailRowsRef.current, basecard)) return;
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

  const toggleExpand = useCallback((basecard: string) => {
    setExpandedBasecards((prev) => {
      const next = new Set(prev);
      if (next.has(basecard)) {
        next.delete(basecard);
      } else {
        next.add(basecard);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    Array.from(expandedBasecards).forEach((basecard) => {
      if (
        !Object.prototype.hasOwnProperty.call(detailRows, basecard) &&
        !detailLoading[basecard]
      ) {
        void fetchDetail(basecard);
      }
    });
  }, [expandedBasecards, detailRows, detailLoading, fetchDetail]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sales-status-grouped?start=${startDate}&end=${endDate}&salesType=${salesType}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const rows = (data.rows ?? []) as SalesStatusGroupedRow[];
      setGroupedRows(rows);
      setSapFetchFailed(data.sapFetchFailed === true);

      const codes = new Set(rows.map((g) => g.basecard));
      setExpandedBasecards((prev) => {
        const next = new Set<string>();
        Array.from(prev).forEach((b) => {
          if (codes.has(b)) next.add(b);
        });
        return next;
      });
      setDetailRows({});
      setDetailLoading({});
    } catch (e) {
      setGroupedRows([]);
      setSapFetchFailed(false);
      setExpandedBasecards(new Set());
      setDetailRows({});
      setDetailLoading({});
      const msg = e instanceof Error ? e.message : "조회 실패";
      modal.open({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, salesType, modal]);

  const summary = groupedRows.length > 0 ? computeSummary(groupedRows) : null;

  const handleExcelDownload = useCallback(async () => {
    if (!summary || groupedRows.length === 0) return;
    try {
      const blob = await buildSalesStatusGroupedExcel({
        groupedRows,
        startDate,
        endDate,
        salesType,
        summary,
        expandedBasecards,
        detailRows,
        detailLoading,
      });
      const defaultName = `거래처현황_판매집계_${startDate}_${endDate}.xlsx`;

      const showSave = (
        window as Window & {
          showSaveFilePicker?: (o: {
            suggestedName?: string;
            types?: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker;
      if (typeof showSave === "function") {
        const handle = await showSave({
          suggestedName: defaultName,
          types: [
            {
              description: "Excel 파일",
              accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      await modal.open({
        type: "error",
        message: e instanceof Error ? e.message : "엑셀 다운로드 실패",
      });
    }
  }, [
    summary,
    groupedRows,
    startDate,
    endDate,
    salesType,
    expandedBasecards,
    detailRows,
    detailLoading,
    modal,
  ]);

  return (
    <div className="sales-status-page">
      <div className="flex flex-wrap items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">거래처 현황(판매집계)</h1>
        <span className="text-sm text-gray-500 font-normal">
          판매 데이터는 매 시간 갱신됩니다.
        </span>
      </div>

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
          onExcelDownload={handleExcelDownload}
          excelDisabled={groupedRows.length === 0}
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
        expandedBasecards={expandedBasecards}
        onToggleExpand={toggleExpand}
        detailRows={detailRows}
        detailLoading={detailLoading}
      />
    </div>
  );
}
