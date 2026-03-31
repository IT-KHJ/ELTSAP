"use client";

import { SIDO_LIST, SIGUN_BY_SIDO } from "@/lib/address-data";

export type SalesType = "all" | "sales" | "return";

interface SalesStatusFilterBProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  salesType: SalesType;
  onSalesTypeChange: (v: SalesType) => void;
  sido: string;
  sigun: string;
  onSidoChange: (v: string) => void;
  onSigunChange: (v: string) => void;
  onLoad: () => void;
  loading: boolean;
  onExcelDownload?: () => void;
  excelDisabled?: boolean;
}

export function SalesStatusFilterB({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  salesType,
  onSalesTypeChange,
  sido,
  sigun,
  onSidoChange,
  onSigunChange,
  onLoad,
  loading,
  onExcelDownload,
  excelDisabled = true,
}: SalesStatusFilterBProps) {
  const sigunOptions = sido ? (SIGUN_BY_SIDO[sido] ?? []) : [];

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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">지역 필터</label>
            <div className="flex items-center gap-2">
              <select
                value={sido}
                onChange={(e) => onSidoChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="">시/도 전체</option>
                {SIDO_LIST.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={sigun}
                onChange={(e) => onSigunChange(e.target.value)}
                disabled={!sido}
                className="px-3 py-2 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">시/군/구 전체</option>
                {sigunOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">판매구분</label>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesTypeB"
                  checked={salesType === "all"}
                  onChange={() => onSalesTypeChange("all")}
                  className="w-4 h-4"
                />
                <span className="text-sm">전체</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesTypeB"
                  checked={salesType === "sales"}
                  onChange={() => onSalesTypeChange("sales")}
                  className="w-4 h-4"
                />
                <span className="text-sm">판매</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="salesTypeB"
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
          {onExcelDownload && (
            <button
              type="button"
              onClick={onExcelDownload}
              disabled={excelDisabled}
              className="h-10 px-5 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              엑셀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
