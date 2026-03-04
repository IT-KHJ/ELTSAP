"use client";

import { useRef, useEffect } from "react";

export type CustomerOption = { cardcode: string; cardname: string | null };

interface FilterPanelProps {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  onStartYearChange: (v: number) => void;
  onStartMonthChange: (v: number) => void;
  onEndYearChange: (v: number) => void;
  onEndMonthChange: (v: number) => void;
  customer: CustomerOption | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCustomerSelect: (c: CustomerOption | null) => void;
  options: CustomerOption[];
  onSearchFocus: () => void;
  onLoadReport: () => void;
  onPrint: () => void;
  loading: boolean;
  hasData: boolean;
}

export function FilterPanel({
  startYear,
  startMonth,
  endYear,
  endMonth,
  onStartYearChange,
  onStartMonthChange,
  onEndYearChange,
  onEndMonthChange,
  customer,
  searchQuery,
  onSearchChange,
  onCustomerSelect,
  options,
  onSearchFocus,
  onLoadReport,
  onPrint,
  loading,
  hasData,
}: FilterPanelProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => {};
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startMonthValue = `${startYear}-${String(startMonth).padStart(2, "0")}`;
  const endMonthValue = `${endYear}-${String(endMonth).padStart(2, "0")}`;

  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const [y, m] = v.split("-").map(Number);
    onStartYearChange(y);
    onStartMonthChange(m);
  };

  const handleEndMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const [y, m] = v.split("-").map(Number);
    onEndYearChange(y);
    onEndMonthChange(m);
  };

  const handleCustomerFocus = () => {
    onSearchFocus();
    setTimeout(() => customerInputRef.current?.select(), 0);
  };

  return (
    <div className="filter-panel-no-print bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">기간 선택</label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={startMonthValue}
                onChange={handleStartMonthChange}
                className="px-3 py-2 border border-gray-300 rounded text-sm cursor-pointer"
                title="시작 월 선택"
              />
              <span className="text-gray-400">~</span>
              <input
                type="month"
                value={endMonthValue}
                onChange={handleEndMonthChange}
                className="px-3 py-2 border border-gray-300 rounded text-sm cursor-pointer"
                title="종료 월 선택"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 relative" ref={dropdownRef}>
            <label className="text-sm font-medium text-gray-700">거래처 검색</label>
            <input
              ref={customerInputRef}
              type="text"
              value={customer ? `${customer.cardcode} ${customer.cardname ?? ""}` : searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onCustomerSelect(null);
              }}
              onFocus={handleCustomerFocus}
              placeholder="코드 또는 이름 검색"
              className="min-w-[320px] w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {options.length > 0 && (
              <ul className="absolute top-full left-0 mt-1 min-w-[320px] max-w-md list-none bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto z-10">
                {options.map((c) => (
                  <li
                    key={c.cardcode}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm truncate"
                    onClick={() => {
                      onCustomerSelect(c);
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
            onClick={onLoadReport}
            disabled={loading}
            className="h-10 px-5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={!hasData}
            className="h-10 px-5 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            인쇄
          </button>
        </div>
      </div>
    </div>
  );
}
