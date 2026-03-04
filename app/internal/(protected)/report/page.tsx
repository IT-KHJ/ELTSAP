"use client";

import { useState, useCallback, Fragment } from "react";
import type { ReportData } from "@/types/report";
import { formatAmount, formatChangePercent } from "@/lib/format";
import { MONTHS } from "@/lib/constants";
import { FilterPanel, type CustomerOption } from "./components/FilterPanel";
import { ReportContainer } from "./components/ReportContainer";
import "./report-print.css";

export default function ReportPage() {
  const [startYear, setStartYear] = useState(2025);
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(2025);
  const [endMonth, setEndMonth] = useState(12);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [specialNote, setSpecialNote] = useState("");

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setOptions([]);
      return;
    }
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const list = (await res.json()) as CustomerOption[];
    setOptions(list);
  }, []);

  const loadReport = async () => {
    if (!customer) {
      alert("거래처를 선택하세요.");
      return;
    }
    setLoading(true);
    try {
      const start = `${startYear}-${String(startMonth).padStart(2, "0")}`;
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}`;
      const res = await fetch(
        `/api/report?cardcode=${encodeURIComponent(customer.cardcode)}&start=${start}&end=${end}`
      );
      if (!res.ok) throw new Error(await res.text());
      const report = (await res.json()) as ReportData;
      setData(report);
    } catch (e) {
      alert(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  const renderChange = (current: number, previous: number) => {
    const { text, isIncrease } = formatChangePercent(current, previous);
    if (text === "-") return <span>-</span>;
    const cls = isIncrease === true ? "report-increase" : isIncrease === false ? "report-decrease" : "";
    return (
      <span className={cls}>
        {isIncrease === true && "▲"}
        {isIncrease === false && "▼"}
        {text}
      </span>
    );
  };

  /** YYYY-MM-DD 형식에서 월 숫자 추출 (1~12, 0이면 1로 보정) */
  const parseMonth = (dateStr: string): number => {
    const parts = dateStr.split("-");
    const m = parseInt(parts[1] ?? "1", 10);
    return m >= 1 && m <= 12 ? m : 1;
  };

  /** 조회기간 기준 월 범위 라벨 (예: "2025년 1월~3월") */
  const prevPeriodShort = data
    ? `${data.previousStartDate.slice(0, 4)}년 ${parseMonth(data.previousStartDate)}월~${parseMonth(data.previousEndDate)}월`
    : "";
  const currPeriodShort = data
    ? `${data.startDate.slice(0, 4)}년 ${parseMonth(data.startDate)}월~${parseMonth(data.endDate)}월`
    : "";

  const monthCols = MONTHS.map((m) => (
    <th key={m} className="report-th" style={{ width: "4%" }}>{m}월</th>
  ));

  return (
    <div className="report-page">
      <div className="filter-panel-no-print mb-5">
        <FilterPanel
          startYear={startYear}
          startMonth={startMonth}
          endYear={endYear}
          endMonth={endMonth}
          onStartYearChange={setStartYear}
          onStartMonthChange={setStartMonth}
          onEndYearChange={setEndYear}
          onEndMonthChange={setEndMonth}
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
          onLoadReport={loadReport}
          onPrint={() => window.print()}
          loading={loading}
          hasData={!!data}
        />
      </div>

      {data && (
        <ReportContainer>
          <div className="mb-8 flex items-start justify-between gap-6">
            <div className="flex flex-col gap-1 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">거래처 현황 보고서</h2>
              <p className="text-lg font-semibold text-gray-900">총판명 : {data.cardname}</p>
            </div>
            <div className="report-kpi-box border border-gray-200 rounded-lg overflow-hidden bg-[#fafafa] flex-1 min-w-0 max-w-2xl">
              <table className="report-summary-table text-sm w-full table-fixed">
                <thead>
                  <tr className="bg-[#f5f6f7]">
                    <th className="report-th py-2.5 px-4 text-left font-semibold w-20">구분</th>
                    <th className="report-th py-2.5 px-4 font-semibold">{prevPeriodShort}</th>
                    <th className="report-th py-2.5 px-4 font-semibold">{currPeriodShort}</th>
                    <th className="report-th py-2.5 px-4 font-semibold w-24">증감</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="report-td py-2.5 px-4">매출</td>
                    <td className="report-td report-td-num py-2.5 px-4">{formatAmount(data.summary.totalPrevious)}</td>
                    <td className="report-td report-td-num py-2.5 px-4">{formatAmount(data.summary.totalCurrent)}</td>
                    <td className={`report-td report-td-num py-2.5 px-4 ${data.summary.changePercent.startsWith("-") ? "report-decrease" : "report-increase"}`}>
                      {data.summary.changePercent !== "-" && (data.summary.changePercent.includes("-") ? "▼" : "▲")}
                      {data.summary.changePercent}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500 px-4 py-2">(단위 : 원, %)</p>
            </div>
          </div>

          <div className="report-section">
            <p className="text-sm font-semibold text-gray-900 mb-3">■ 매출 채권 현황</p>
            <div className="report-table-wrap overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr>
                    <th className="report-th w-[10%]">구분</th>
                    <th className="report-th w-[6%]">연도</th>
                    {monthCols}
                    <th className="report-th w-[8%]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salesByCategory.map((cat, catIdx) => (
                    <Fragment key={cat.categoryCode}>
                      <tr className={catIdx % 2 === 0 ? "report-row-even" : ""}>
                        <td className="report-td" rowSpan={3}>{cat.categoryLabel}</td>
                        <td className="report-td">{data.previousStartDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num">{formatAmount(cat.previousYear.total)}</td>
                      </tr>
                      <tr className={catIdx % 2 === 0 ? "report-row-even" : ""}>
                        <td className="report-td">{data.startDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num">{formatAmount(cat.currentYear.total)}</td>
                      </tr>
                      <tr className={catIdx % 2 === 0 ? "report-row-even" : ""}>
                        <td className="report-td">증감</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {renderChange(
                              (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                              (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                            )}
                          </td>
                        ))}
                        <td className="report-td report-td-num">
                          {renderChange(cat.currentYear.total, cat.previousYear.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section">
            <p className="text-sm font-semibold text-gray-900 mb-3">채권</p>
            <div className="report-table-wrap overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr>
                    <th className="report-th w-[12%]">구분</th>
                    {monthCols}
                    <th className="report-th w-[8%]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="report-row-even">
                    <td className="report-td">요청금액</td>
                    {MONTHS.map((m) => (<td key={m} className="report-td" />))}
                    <td className="report-td" />
                  </tr>
                  <tr>
                    <td className="report-td">실제 입금액</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.inamt.currentYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num">{formatAmount(data.inamt.currentYear.total)}</td>
                  </tr>
                  <tr className="report-row-even">
                    <td className="report-td">회수율</td>
                    {MONTHS.map((m) => (<td key={m} className="report-td" />))}
                    <td className="report-td" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section">
            <p className="text-sm font-semibold text-gray-900 mb-3">증정수량</p>
            <div className="report-table-wrap overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr>
                    <th className="report-th w-[12%]">구분</th>
                    {monthCols}
                    <th className="report-th w-[8%]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="report-row-even">
                    <td className="report-td">{data.previousStartDate.slice(0, 4)}년</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.giftQty.previousYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num">{formatAmount(data.giftQty.previousYear.total)}</td>
                  </tr>
                  <tr>
                    <td className="report-td">{data.startDate.slice(0, 4)}년</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.giftQty.currentYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num">{formatAmount(data.giftQty.currentYear.total)}</td>
                  </tr>
                  <tr className="report-row-even">
                    <td className="report-td">증감</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {renderChange(
                          (data.giftQty.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                          (data.giftQty.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                        )}
                      </td>
                    ))}
                    <td className="report-td report-td-num">
                      {renderChange(data.giftQty.currentYear.total, data.giftQty.previousYear.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section flex gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                ■ 주요품목 판매 현황 (조회기간: {currPeriodShort})
              </p>
              <div className="report-table-wrap overflow-x-auto">
                <table className="report-table w-full">
                  <thead>
                    <tr>
                      <th className="report-th text-left">교재명</th>
                      <th className="report-th">{prevPeriodShort}</th>
                      <th className="report-th">{currPeriodShort}</th>
                      <th className="report-th">증감</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topBrands ?? []).map((r, idx) => (
                      <tr key={r.brand} className={idx % 2 === 0 ? "report-row-even" : ""}>
                        <td className="report-td text-left">{r.brand}</td>
                        <td className="report-td report-td-num">{formatAmount(r.qtyPrevious)}</td>
                        <td className="report-td report-td-num">{formatAmount(r.qtyCurrent)}</td>
                        <td className="report-td report-td-num">
                          <span className={r.isIncrease === true ? "report-increase" : r.isIncrease === false ? "report-decrease" : ""}>
                            {r.changePercent !== "-" && (r.isIncrease === true ? "▲" : r.isIncrease === false ? "▼" : "")}
                            {r.changePercent}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-3">■ 특이사항</p>
              <textarea
                className="report-note-input screen-only w-full min-h-[120px] border border-gray-300 rounded p-3 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="특이사항을 입력하세요."
              />
              <div className="report-print-note print-only mt-2 border border-gray-300 min-h-[120px] p-3 text-sm whitespace-pre-wrap bg-white">
                {specialNote || " "}
              </div>
            </div>
          </div>
        </ReportContainer>
      )}
    </div>
  );
}
