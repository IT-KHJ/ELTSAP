"use client";

import { useRef, useState } from "react";
import type { LedgerCustomerOption } from "@/types/ledger";

interface LedgerFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  customer: LedgerCustomerOption | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCustomerSelect: (c: LedgerCustomerOption | null) => void;
  options: LedgerCustomerOption[];
  onSearchFocus: () => void;
  onLoad: () => void;
  onExcelDownload: () => void;
  loading: boolean;
  hasData: boolean;
}

export function LedgerFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  customer,
  searchQuery,
  onSearchChange,
  onCustomerSelect,
  options,
  onSearchFocus,
  onLoad,
  onExcelDownload,
  loading,
  hasData,
}: LedgerFilterProps) {
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleCustomerFocus = () => {
    setIsFocused(true);
    onSearchFocus();
    setTimeout(() => customerInputRef.current?.select(), 0);
  };

  const handleCustomerBlur = () => {
    setTimeout(() => setIsFocused(false), 150);
  };

  return (
    <div className="filter-panel-no-print bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">기간 선택</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-sm cursor-pointer"
                title="시작일"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-sm cursor-pointer"
                title="종료일"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 relative">
            <label className="text-sm font-medium text-gray-700">거래처 검색 (자동완성)</label>
            <input
              ref={customerInputRef}
              type="text"
              value={customer ? `${customer.cardcode} ${customer.cardname ?? ""}` : searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onCustomerSelect(null);
              }}
              onFocus={handleCustomerFocus}
              onBlur={handleCustomerBlur}
              placeholder="코드 또는 이름 입력 시 자동완성"
              className="min-w-[320px] w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {isFocused && options.length > 0 && (
              <ul className="absolute top-full left-0 mt-1 min-w-[320px] max-w-md list-none bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto z-10">
                {options.map((c) => (
                  <li
                    key={c.cardcode}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm truncate"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onCustomerSelect(c);
                      setIsFocused(false);
                    }}
                    title={`${c.cardcode} ${c.cardname ?? ""}`}
                  >
                    {c.cardcode} {c.cardname ?? ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoad}
            disabled={loading}
            className="h-10 px-5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
          <button
            type="button"
            onClick={onExcelDownload}
            disabled={!hasData || loading}
            className="h-10 px-5 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            엑셀
          </button>
        </div>
      </div>
    </div>
  );
}
