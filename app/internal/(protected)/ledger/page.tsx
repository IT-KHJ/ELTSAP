"use client";

import { useState, useCallback, useMemo } from "react";
import { useModal } from "@/lib/components/ModalProvider";
import { formatAmount } from "@/lib/format";
import { buildLedgerExcel } from "@/lib/ledger-excel";
import { LedgerFilter } from "./components/LedgerFilter";
import { LedgerGrid } from "./components/LedgerGrid";
import type { LedgerCustomerOption, LedgerResponse } from "@/types/ledger";

/** 기본 조회 기간: 올해 1월 1일 ~ 오늘 (로컬 날짜 기준) */
function getDefaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { start: `${y}-01-01`, end: `${y}-${m}-${d}` };
}

export default function LedgerPage() {
  const modal = useModal();
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [customer, setCustomer] = useState<LedgerCustomerOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<LedgerCustomerOption[]>([]);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const searchCustomers = useCallback(async (q: string) => {
    const res = await fetch(`/api/ledger/customers?q=${encodeURIComponent(q.trim())}`);
    const list = await res.json();
    setOptions(Array.isArray(list) ? (list as LedgerCustomerOption[]) : []);
  }, []);

  const handleLoad = useCallback(async () => {
    if (!customer) {
      await modal.open({ type: "error", message: "거래처를 선택하세요." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ledger?cardcode=${encodeURIComponent(customer.cardcode)}&start=${startDate}&end=${endDate}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "조회 실패");
      setData(body as LedgerResponse);
    } catch (e) {
      setData(null);
      await modal.open({ type: "error", message: e instanceof Error ? e.message : "조회 실패" });
    } finally {
      setLoading(false);
    }
  }, [customer, startDate, endDate, modal]);

  const handleExcelDownload = useCallback(async () => {
    if (!data) return;
    try {
      const blob = await buildLedgerExcel(data);
      const defaultName = `거래원장_${data.cardcode}_${data.startDate}_${data.endDate}.xlsx`;

      const showSave = (window as Window & { showSaveFilePicker?: (o: { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
      if (typeof showSave === "function") {
        const handle = await showSave({
          suggestedName: defaultName,
          types: [{ description: "Excel 파일", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
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
      await modal.open({ type: "error", message: e instanceof Error ? e.message : "엑셀 다운로드 실패" });
    }
  }, [data, modal]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">거래처 거래원장</h1>
        <span className="text-sm text-gray-500 font-normal">
          SAP 원본 데이터 기준 · 평일 업무시간 매시 갱신 · 채권잔액은 납품 시점 기준
        </span>
      </div>

      <div className="mb-4">
        <LedgerFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          customer={customer}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setCustomer(null);
            searchCustomers(q);
          }}
          onCustomerSelect={(c) => {
            setCustomer(c);
            setOptions([]);
          }}
          options={options}
          onSearchFocus={() => searchCustomers(searchQuery)}
          onLoad={handleLoad}
          onExcelDownload={handleExcelDownload}
          loading={loading}
          hasData={!!data}
        />
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap gap-x-10 gap-y-2 px-5 py-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="text-sm text-gray-600">거래처</span>
            <span className="ml-2 font-bold">{data.cardcode} {data.cardname}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">전기이월</span>
            <span className="ml-2 font-bold tabular-nums">{formatAmount(data.totals.opening)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">발생액</span>
            <span className="ml-2 font-bold tabular-nums">{formatAmount(data.totals.occur)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">취소액</span>
            <span className="ml-2 font-bold tabular-nums">{formatAmount(data.totals.cancel)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">회수액</span>
            <span className="ml-2 font-bold tabular-nums">{formatAmount(data.totals.collect)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">기말 채권잔액</span>
            <span className="ml-2 font-bold tabular-nums text-primary">{formatAmount(data.totals.closing)}</span>
          </div>
        </div>
      )}

      <LedgerGrid
        key={data ? `${data.cardcode}-${data.startDate}-${data.endDate}-${data.rows.length}` : "empty"}
        rows={data?.rows ?? []}
      />
    </div>
  );
}
