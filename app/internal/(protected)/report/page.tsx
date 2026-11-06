"use client";

import { useState, useCallback, Fragment, useMemo, useRef } from "react";
import type { ReportData, SalesByCategory } from "@/types/report";
import { formatAmount, formatChangePercent } from "@/lib/format";
import { MONTHS, CATEGORY_BG, CATEGORY_OUP } from "@/lib/constants";
import { useModal } from "@/lib/components/ModalProvider";
import { FilterPanel, type CustomerOption } from "./components/FilterPanel";
import { ReportContainer } from "./components/ReportContainer";
import { buildReportExcel } from "@/lib/report-excel";
import "./report-print.css";
import { UserMessageError, readApiError, retryMessage, toUserMessage } from "@/lib/user-error";

function getDefaultPeriod() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1~12
  if (currentMonth === 1) {
    // 1월인 경우: 전년 1월 ~ 전년 12월
    return { startYear: currentYear - 1, startMonth: 1, endYear: currentYear - 1, endMonth: 12 };
  }
  // 그 외: 당해 1월 ~ 당월 -1개월
  return {
    startYear: currentYear,
    startMonth: 1,
    endYear: currentYear,
    endMonth: currentMonth - 1,
  };
}

export default function ReportPage() {
  const modal = useModal();
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [startYear, setStartYear] = useState(defaultPeriod.startYear);
  const [startMonth, setStartMonth] = useState(defaultPeriod.startMonth);
  const [endYear, setEndYear] = useState(defaultPeriod.endYear);
  const [endMonth, setEndMonth] = useState(defaultPeriod.endMonth);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  /** 중고등 과목 하위 행 접기/펼치기 상태 (키: subject-└ 수학 등, 값 없으면 기본값) */
  const [subjectOpen, setSubjectOpen] = useState<Record<string, boolean>>({});

  // 거래처 자동완성: 입력이 멈춘 뒤(250ms) 검색하고, 가장 최근 요청의 응답만 반영
  // (응답이 늦게 도착한 이전 검색 결과가 현재 목록을 덮어쓰지 않도록)
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = useCallback((q: string) => {
    const seq = ++searchSeqRef.current;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q.trim())}`);
      const list = (await res.json()) as CustomerOption[];
      if (seq === searchSeqRef.current) setOptions(list);
    }, 250);
  }, []);

  const loadReport = async () => {
    if (!customer) {
      await modal.open({ type: "info", message: "거래처를 선택하세요." });
      return;
    }
    setLoading(true);
    try {
      const start = `${startYear}-${String(startMonth).padStart(2, "0")}`;
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}`;
      const res = await fetch(
        `/api/report?cardcode=${encodeURIComponent(customer.cardcode)}&start=${start}&end=${end}`
      );
      if (!res.ok) throw new UserMessageError(await readApiError(res, retryMessage("보고서를 불러오지 못했어요.")));
      const report = (await res.json()) as ReportData;
      setSubjectOpen({});
      setData(report);
    } catch (e) {
      await modal.open({ type: "error", message: toUserMessage(e, retryMessage("보고서를 불러오지 못했어요.")) });
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = useCallback(async () => {
    if (!data) return;
    try {
      const blob = await buildReportExcel(data);
      const defaultName = `거래처현황_${data.cardcode}_${data.startDate}_${data.endDate}.xlsx`;

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
      await modal.open({ type: "error", message: toUserMessage(e, retryMessage("엑셀 파일을 만들지 못했어요.")) });
    }
  }, [data, modal]);

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

  /** 반품: 절대값 기준으로 반품 규모 감소=▼, 증가=▲ (invertForNegative 미적용) */
  const renderChangeForReturns = (current: number, previous: number) => {
    const { text, isIncrease } = formatChangePercent(current, previous, { invertForNegative: false });
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
  /** 주요품목 판매 현황용 연도만 표기 (예: "2024년", "2025년") */
  const prevYearLabel = data ? `${data.previousStartDate.slice(0, 4)}년` : "";
  const currYearLabel = data ? `${data.startDate.slice(0, 4)}년` : "";

  const monthCols = MONTHS.map((m) => (
    <th key={m} className="report-th" style={{ width: "4%" }}>{m}월</th>
  ));

  /**
   * 중고등 과목별 하위 행(└ 영어/수학/국어) — 중고등 매출/반품 행 바로 아래, 같은 배경색.
   * 과목명 클릭으로 접기/펼치기(매출·반품 따로). 기본: 영어 펼침, 수학·국어 접힘(접히면 올해 1줄만). 조회 시 기본값으로 초기화
   */
  const renderSubjectRows = (cats: SalesByCategory[], isReturn: boolean) => {
    if (!data) return null;
    const change = isReturn ? renderChangeForReturns : renderChange;
    return cats.map((cat) => {
      const key = `${isReturn ? "subject-return" : "subject"}-${cat.categoryLabel}`;
      const open = subjectOpen[key] ?? cat.categoryLabel.endsWith("영어");
      const labelCell = (
        <td className="report-td report-td-category" rowSpan={open ? 3 : 1} style={{ fontWeight: "normal" }}>
          <button
            type="button"
            onClick={() => setSubjectOpen((s) => ({ ...s, [key]: !open }))}
            title={open ? "클릭하면 접힙니다" : "클릭하면 펼쳐집니다"}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded px-1 cursor-pointer hover:bg-black/5 hover:underline"
          >
            {cat.categoryLabel}
            <span className="text-[10px] text-gray-500 print:hidden">{open ? "▾" : "▸"}</span>
          </button>
        </td>
      );
      if (!open) {
        return (
          <tr key={key} className="report-sales-category-bg report-row-current">
            {labelCell}
            <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
            {MONTHS.map((m) => (
              <td key={m} className="report-td report-td-num">
                {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
              </td>
            ))}
            <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
          </tr>
        );
      }
      return (
      <Fragment key={key}>
        <tr className="report-row-even report-sales-category-bg">
          {labelCell}
          <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
          {MONTHS.map((m) => (
            <td key={m} className="report-td report-td-num">
              {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
            </td>
          ))}
          <td className="report-td report-td-num report-td-total">{formatAmount(cat.previousYear.total)}</td>
        </tr>
        <tr className="report-sales-category-bg report-row-current">
          <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
          {MONTHS.map((m) => (
            <td key={m} className="report-td report-td-num">
              {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
            </td>
          ))}
          <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
        </tr>
        <tr className="report-row-even report-sales-category-bg report-row-current">
          <td className="report-td report-td-gubun">증감</td>
          {MONTHS.map((m) => (
            <td key={m} className="report-td report-td-num">
              {change(
                (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
              )}
            </td>
          ))}
          <td className="report-td report-td-num report-td-total">{change(cat.currentYear.total, cat.previousYear.total)}</td>
        </tr>
      </Fragment>
      );
    });
  };

  /** B&G/OUP/채권/증정수량 블록 사이 구분용 빈 행 (기존 행 높이의 절반) */
  const SpacerRow = () => (
    <tr className="report-row-spacer">
      <td colSpan={15} className="report-td-spacer" />
    </tr>
  );

  return (
    <div className="report-page">
      <div className="filter-panel-no-print mb-2">
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
            if (c) searchSeqRef.current++; // 선택 후 도착하는 검색 응답은 무시
            setCustomer(c);
            setOptions([]);
          }}
          options={options}
          onSearchFocus={() => searchCustomers(searchQuery)}
          onLoadReport={loadReport}
          onExcelDownload={handleExcelDownload}
          loading={loading}
          hasData={!!data}
        />
      </div>

      {data && (
        <ReportContainer>
          <div className="mb-1 flex items-start justify-between gap-6">
            <div className="flex flex-col gap-1 shrink-0">
              <p className="text-2xl font-semibold text-gray-900">{data.segment === "중고등" ? "지사명" : "총판명"} : {data.cardname}</p>
            </div>
            <div className="report-kpi-box border border-gray-200 rounded-lg overflow-hidden bg-[#fafafa] flex-1 min-w-0 max-w-2xl">
              <table className="report-summary-table text-sm w-full table-fixed">
                <thead>
                  <tr className="bg-[#f5f6f7]">
                    <th className="report-th py-0.5 px-4 font-semibold w-20">구분</th>
                    <th className="report-th py-0.5 px-4 font-semibold">{prevPeriodShort}</th>
                    <th className="report-th py-0.5 px-4 font-semibold">{currPeriodShort}</th>
                    <th className="report-th py-0.5 px-4 font-semibold w-24">증감</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="report-td py-0.5 px-4">매출</td>
                    <td className="report-td report-td-num py-0.5 px-4">{formatAmount(data.summary.totalPrevious)}</td>
                    <td className="report-td report-td-num report-td-current py-0.5 px-4">{formatAmount(data.summary.totalCurrent)}</td>
                    <td className={`report-td report-td-current py-0.5 px-4 ${data.summary.changePercent.startsWith("-") ? "report-decrease" : "report-increase"}`}>
                      {data.summary.changePercent !== "-" && (data.summary.changePercent.includes("-") ? "▼" : "▲")}
                      {data.summary.changePercent}
                    </td>
                  </tr>
                  <tr>
                    <td className="report-td py-0.5 px-4">반품</td>
                    <td className="report-td report-td-num py-0.5 px-4">{formatAmount(data.summary.returnTotalPrevious)}</td>
                    <td className="report-td report-td-num report-td-current py-0.5 px-4">{formatAmount(data.summary.returnTotalCurrent)}</td>
                    <td className={`report-td report-td-current py-0.5 px-4 ${data.summary.returnChangePercent.startsWith("-") ? "report-decrease" : "report-increase"}`}>
                      {data.summary.returnChangePercent !== "-" && (data.summary.returnChangePercent.includes("-") ? "▼" : "▲")}
                      {data.summary.returnChangePercent}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-gray-900">■ 매출 채권 현황</p>
              <p className="text-xs text-gray-500">(단위 : 원, %)</p>
            </div>
            <div className="report-table-wrap overflow-x-auto">
              <table className="report-table report-unified-table w-full">
                <thead>
                  <tr>
                    <th className="report-th report-th-category w-[8%]"></th>
                    <th className="report-th report-th-gubun w-[6%]">구분</th>
                    {monthCols}
                    <th className="report-th w-[8%]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* B&G 매출 */}
                  {data.salesByCategory.filter((c) => c.categoryCode === CATEGORY_BG).map((cat) => (
                    <Fragment key={cat.categoryCode}>
                      <tr className="report-row-even report-sales-category-bg">
                        <td className="report-td report-td-category" rowSpan={3}>{cat.categoryLabel}</td>
                        <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.previousYear.total)}</td>
                      </tr>
                      <tr className="report-sales-category-bg report-row-current">
                        <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
                      </tr>
                      <tr className="report-row-even report-sales-category-bg report-row-current">
                        <td className="report-td report-td-gubun">증감</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {renderChange(
                              (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                              (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                            )}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">
                          {renderChange(cat.currentYear.total, cat.previousYear.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  {renderSubjectRows(data.subjectSales ?? [], false)}
                  <SpacerRow />
                  {/* OUP 매출 */}
                  {data.salesByCategory.filter((c) => c.categoryCode === CATEGORY_OUP).map((cat) => (
                    <Fragment key={cat.categoryCode}>
                      <tr className="report-row-even report-sales-category-oup">
                        <td className="report-td report-td-category" rowSpan={3}>{cat.categoryLabel}</td>
                        <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.previousYear.total)}</td>
                      </tr>
                      <tr className="report-sales-category-oup report-row-current">
                        <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
                      </tr>
                      <tr className="report-row-even report-sales-category-oup report-row-current">
                        <td className="report-td report-td-gubun">증감</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {renderChange(
                              (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                              (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                            )}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">
                          {renderChange(cat.currentYear.total, cat.previousYear.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  <SpacerRow />
                  {/* B&G 반품 */}
                  {data.returnsByCategory.filter((c) => c.categoryCode === CATEGORY_BG).map((cat) => (
                    <Fragment key={`return-${cat.categoryCode}`}>
                      <tr className="report-row-even report-sales-category-bg">
                        <td className="report-td report-td-category" rowSpan={3}>{cat.categoryLabel}</td>
                        <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.previousYear.total)}</td>
                      </tr>
                      <tr className="report-sales-category-bg report-row-current">
                        <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
                      </tr>
                      <tr className="report-row-even report-sales-category-bg report-row-current">
                        <td className="report-td report-td-gubun">증감</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {renderChangeForReturns(
                              (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                              (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                            )}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">
                          {renderChangeForReturns(cat.currentYear.total, cat.previousYear.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  {renderSubjectRows(data.subjectReturns ?? [], true)}
                  {/* OUP 반품 */}
                  {data.returnsByCategory.filter((c) => c.categoryCode === CATEGORY_OUP).map((cat) => (
                    <Fragment key={`return-${cat.categoryCode}`}>
                      <tr className="report-row-even report-sales-category-oup">
                        <td className="report-td report-td-category" rowSpan={3}>{cat.categoryLabel}</td>
                        <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.previousYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.previousYear.total)}</td>
                      </tr>
                      <tr className="report-sales-category-oup report-row-current">
                        <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {formatAmount((cat.currentYear as unknown as Record<string, number>)[String(m)])}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">{formatAmount(cat.currentYear.total)}</td>
                      </tr>
                      <tr className="report-row-even report-sales-category-oup report-row-current">
                        <td className="report-td report-td-gubun">증감</td>
                        {MONTHS.map((m) => (
                          <td key={m} className="report-td report-td-num">
                            {renderChangeForReturns(
                              (cat.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                              (cat.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                            )}
                          </td>
                        ))}
                        <td className="report-td report-td-num report-td-total">
                          {renderChangeForReturns(cat.currentYear.total, cat.previousYear.total)}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                  <SpacerRow />
                  {/* 채권 */}
                  <tr className="report-row-inamt">
                    <td className="report-td report-td-category" rowSpan={3}>채권</td>
                    <td className="report-td report-td-gubun">요청금액</td>
                    {MONTHS.map((m) => (<td key={m} className="report-td" />))}
                    <td className="report-td report-td-total" />
                  </tr>
                  <tr className="report-row-inamt report-row-inamt-highlight">
                    <td className="report-td report-td-gubun">실제 입금액</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.inamt.currentYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num report-td-total">{formatAmount(data.inamt.currentYear.total)}</td>
                  </tr>
                  <tr className="report-row-inamt">
                    <td className="report-td report-td-gubun">회수율</td>
                    {MONTHS.map((m) => (<td key={m} className="report-td" />))}
                    <td className="report-td report-td-total" />
                  </tr>
                  <SpacerRow />
                  {/* 증정수량 */}
                  <tr className="report-row-inamt">
                    <td className="report-td report-td-category" rowSpan={3}>증정수량</td>
                    <td className="report-td report-td-gubun">{data.previousStartDate.slice(0, 4)}년</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.giftQty.previousYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num report-td-total">{formatAmount(data.giftQty.previousYear.total)}</td>
                  </tr>
                  <tr className="report-row-current report-row-inamt report-row-inamt-highlight">
                    <td className="report-td report-td-gubun">{data.startDate.slice(0, 4)}년</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {formatAmount((data.giftQty.currentYear as unknown as Record<string, number>)[String(m)])}
                      </td>
                    ))}
                    <td className="report-td report-td-num report-td-total">{formatAmount(data.giftQty.currentYear.total)}</td>
                  </tr>
                  <tr className="report-row-current report-row-inamt report-row-inamt-highlight">
                    <td className="report-td report-td-gubun">증감</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="report-td report-td-num">
                        {renderChange(
                          (data.giftQty.currentYear as unknown as Record<string, number>)[String(m)] ?? 0,
                          (data.giftQty.previousYear as unknown as Record<string, number>)[String(m)] ?? 0
                        )}
                      </td>
                    ))}
                    <td className="report-td report-td-num report-td-total">
                      {renderChange(data.giftQty.currentYear.total, data.giftQty.previousYear.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-section">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              ■ 주요품목 판매 현황 (조회기간: {currPeriodShort})
            </p>
            {(() => {
              const brands = data.topBrands ?? [];
              const n = brands.length;
              const third = Math.ceil(n / 3);
              const slices = [
                brands.slice(0, third),
                brands.slice(third, third * 2),
                brands.slice(third * 2),
              ];
              const maxBrandLen = Math.max(0, ...brands.map((r) => (r.brand || "").length));
              const brandColWidthPx = maxBrandLen * 9 + 10;
              return (
                <table className="report-topbrands-split w-full table-fixed border-collapse">
                  <tbody>
                    <tr className="align-top">
                      {slices.map((rows, i) => (
                        <td key={i} className={`w-1/3 p-0 align-top ${i === 0 ? "pr-2" : i === 1 ? "px-2" : "pl-2"}`}>
                          <div className="report-table-wrap overflow-x-auto">
                            <table
                              className="report-table report-topbrands report-topbrands-narrow w-full"
                              style={{ "--brand-col-width": `${brandColWidthPx}px` } as React.CSSProperties}
                            >
                              <thead>
                                <tr>
                                  <th className="report-th report-th-narrow text-left">교재명</th>
                                  <th className="report-th report-th-narrow">{prevYearLabel}</th>
                                  <th className="report-th report-th-narrow">{currYearLabel}</th>
                                  <th className="report-th report-th-narrow">증감</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r, idx) => (
                                  <tr key={`${r.brand}-${i}-${idx}`} className={idx % 2 === 0 ? "report-row-even" : ""}>
                                    <td className="report-td report-td-narrow text-left">{r.brand}</td>
                                    <td className="report-td report-td-narrow report-td-num">{formatAmount(r.qtyPrevious)}</td>
                                    <td className="report-td report-td-narrow report-td-num report-td-current">{formatAmount(r.qtyCurrent)}</td>
                                    <td className="report-td report-td-narrow report-td-num report-td-current">
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
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </ReportContainer>
      )}
    </div>
  );
}
