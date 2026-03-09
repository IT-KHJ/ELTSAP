"use client";

import { useRef } from "react";

export type CustomerOption = { cardcode: string; cardname: string | null };

interface DashboardFilterProps {
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
  onLoad: () => void;
  loading: boolean;
  hasData: boolean;
}

/** FilterPanel 패턴 참고: onLoadReport 인자 없이 호출, 기간/거래처는 부모 state에서 관리 */
export function DashboardFilter({
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
  onLoad,
  loading,
  hasData,
}: DashboardFilterProps) {
  const customerInputRef = useRef<HTMLInputElement>(null);

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
          <div className="flex flex-col gap-1 relative">
            <label className="text-sm font-medium text-gray-700">거래처 필터 (선택)</label>
            <input
              ref={customerInputRef}
              type="text"
              value={customer ? `${customer.cardcode} ${customer.cardname ?? ""}` : searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onCustomerSelect(null);
              }}
              onFocus={handleCustomerFocus}
              placeholder="코드 또는 이름 입력 시 자동완성"
              className="min-w-[320px] w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {options.length > 0 && (
              <ul className="absolute top-full left-0 mt-1 min-w-[320px] max-w-md list-none bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto z-10">
                {options.map((c) => (
                  <li
                    key={c.cardcode}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm truncate"
                    onClick={() => onCustomerSelect(c)}
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
            className="h-10 px-5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>
    </div>
  );
}
