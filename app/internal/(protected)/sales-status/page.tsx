"use client";

import { useState, useCallback, useMemo } from "react";
import { useModal } from "@/lib/components/ModalProvider";
import { SalesStatusFilter, type CustomerOption, type SalesType } from "./components/SalesStatusFilter";
import { SalesStatusGrid } from "./components/SalesStatusGrid";
import { formatAmount } from "@/lib/format";
import type { SalesStatusRow, SalesStatusSummary } from "@/types/sales-status";

function getDefaultDateRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end };
}

export default function SalesStatusPage() {
  const modal = useModal();
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("전체");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [salesType, setSalesType] = useState<SalesType>("all");
  const [rows, setRows] = useState<SalesStatusRow[]>([]);
  const [summary, setSummary] = useState<SalesStatusSummary | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sapFetchFailed, setSapFetchFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const searchCustomers = useCallback(async (q: string) => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q.trim())}`);
    const list = (await res.json()) as CustomerOption[];
    setOptions(list);
  }, []);

  const loadData = useCallback(
    async (isLoadMore: boolean) => {
      setLoading(true);
      try {
        const cardcode = customer?.cardcode ?? null;
        const currentOffset = isLoadMore ? offset : 0;
        const res = await fetch(
          `/api/sales-status?start=${startDate}&end=${endDate}&salesType=${salesType}&offset=${currentOffset}&limit=100${cardcode ? `&cardcode=${encodeURIComponent(cardcode)}` : ""}`
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (isLoadMore) {
          setRows((prev) => [...prev, ...(data.rows ?? [])]);
        } else {
          setRows(data.rows ?? []);
        }
        if (!isLoadMore) {
          setSummary(data.summary ?? null);
          setSapFetchFailed(data.sapFetchFailed === true);
        }
        setHasMore(data.hasMore === true);
        setOffset(currentOffset + (data.rows?.length ?? 0));
      } catch (e) {
        if (!isLoadMore) {
          setRows([]);
          setSummary(null);
          setSapFetchFailed(false);
        }
        const msg = e instanceof Error ? e.message : "조회 실패";
        if (!isLoadMore) {
          modal.open({ type: "error", message: msg });
        }
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, salesType, customer?.cardcode, offset, modal]
  );

  const handleLoad = useCallback(() => {
    setOffset(0);
    loadData(false);
  }, [loadData]);

  const handleLoadMore = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return (
    <div className="sales-status-page">
      <div className="flex flex-wrap items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">거래처 현황(판매기준)</h1>
        <span className="text-sm text-gray-500 font-normal">
          판매 데이터는 매 시간 갱신됩니다.
        </span>
      </div>

      <div className="mb-4">
        <SalesStatusFilter
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
          salesType={salesType}
          onSalesTypeChange={setSalesType}
          onLoad={handleLoad}
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

      <SalesStatusGrid rows={rows} hasMore={hasMore} loading={loading} onLoadMore={handleLoadMore} />
    </div>
  );
}
