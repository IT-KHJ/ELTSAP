"use client";

import { useRef, useState } from "react";

export type CustomerOption = { cardcode: string; cardname: string | null };

export type SalesType = "all" | "sales" | "return";

interface SalesStatusFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  customer: CustomerOption | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCustomerSelect: (c: CustomerOption | null) => void;
  options: CustomerOption[];
  onSearchFocus: () => void;
  salesType: SalesType;
  onSalesTypeChange: (v: SalesType) => void;
  onLoad: () => void;
  loading: boolean;
}

export function SalesStatusFilter({
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
  salesType,
  onSalesTypeChange,
  onLoad,
  loading,
}: SalesStatusFilterProps) {
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

  const displayOptions = [{ cardcode: "__ALL__", cardname: "전체" } as CustomerOption, ...options];

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
              onBlur={handleCustomerBlur}
              placeholder="전체 또는 코드/이름 입력"
              className="min-w-[320px] w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm"
            />
            {isFocused && (
              <ul className="absolute top-full left-0 mt-1 min-w-[320px] max-w-md list-none bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto z-10">
                {displayOptions.map((c) => (
                  <li
                    key={c.cardcode}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm truncate"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (c.cardcode === "__ALL__") {
                        onSearchChange("전체");
                        onCustomerSelect(null);
                      } else {
                        onCustomerSelect(c);
                      }
                    }}
                    title={c.cardcode === "__ALL__" ? "전체" : `${c.cardcode} ${c.cardname ?? ""}`}
                  >
                    {c.cardcode === "__ALL__" ? "전체" : `${c.cardcode} ${c.cardname ?? ""}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">판매구분</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesType"
                  checked={salesType === "all"}
                  onChange={() => onSalesTypeChange("all")}
                  className="w-4 h-4"
                />
                <span className="text-sm">전체</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesType"
                  checked={salesType === "sales"}
                  onChange={() => onSalesTypeChange("sales")}
                  className="w-4 h-4"
                />
                <span className="text-sm">판매</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesType"
                  checked={salesType === "return"}
                  onChange={() => onSalesTypeChange("return")}
                  className="w-4 h-4"
                />
                <span className="text-sm">반품</span>
              </label>
            </div>
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
