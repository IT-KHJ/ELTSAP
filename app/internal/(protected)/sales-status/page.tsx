"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useModal } from "@/lib/components/ModalProvider";
import { SalesStatusFilter, type CustomerOption, type SalesType } from "./components/SalesStatusFilter";
import { SalesStatusGrid } from "./components/SalesStatusGrid";
import { formatAmount } from "@/lib/format";
import { DEFAULT_SEGMENT, SEGMENT_OPTIONS, type Segment } from "@/lib/constants";
import { buildSalesStatusExcel } from "@/lib/sales-status-excel";
import type { SalesStatusRow, SalesStatusSummary } from "@/types/sales-status";
import { UserMessageError, readApiError, retryMessage, toUserMessage } from "@/lib/user-error";

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
  const [sido, setSido] = useState("");
  const [sigun, setSigun] = useState("");
  const [segment, setSegment] = useState<Segment>(DEFAULT_SEGMENT);
  const [rows, setRows] = useState<SalesStatusRow[]>([]);
  const [summary, setSummary] = useState<SalesStatusSummary | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sapFetchFailed, setSapFetchFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  /** 엑셀 준비 중 진행 문구 (null = 대기) */
  const [excelProgress, setExcelProgress] = useState<string | null>(null);
  /** 마지막 조회 조건 — 엑셀은 화면에 보이는 결과와 같은 조건으로 만든다 (조회 후 조건만 바꾼 경우 대비) */
  const lastQueryRef = useRef<{
    startDate: string;
    endDate: string;
    salesType: SalesType;
    cardcode: string | null;
    customerLabel: string;
    sido: string;
    sigun: string;
    segment: Segment;
  } | null>(null);

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

  const loadData = useCallback(
    async (isLoadMore: boolean) => {
      setLoading(true);
      try {
        const cardcode = customer?.cardcode ?? null;
        const currentOffset = isLoadMore ? offset : 0;
        let url = `/api/sales-status?start=${startDate}&end=${endDate}&salesType=${salesType}&offset=${currentOffset}&limit=100&segment=${encodeURIComponent(segment)}`;
        if (cardcode) url += `&cardcode=${encodeURIComponent(cardcode)}`;
        if (sido) url += `&sido=${encodeURIComponent(sido)}`;
        if (sigun) url += `&sigun=${encodeURIComponent(sigun)}`;
        if (!isLoadMore) {
          lastQueryRef.current = {
            startDate, endDate, salesType, cardcode,
            customerLabel: customer ? `${customer.cardcode} ${customer.cardname ?? ""}`.trim() : "전체",
            sido, sigun, segment,
          };
        }
        const res = await fetch(url);
        if (!res.ok) throw new UserMessageError(await readApiError(res, retryMessage("판매 자료를 불러오지 못했어요.")));
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
        const msg = toUserMessage(e, retryMessage("판매 자료를 불러오지 못했어요."));
        if (!isLoadMore) {
          modal.open({ type: "error", message: msg });
        }
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, salesType, customer, sido, sigun, segment, offset, modal]
  );

  const handleLoad = useCallback(() => {
    setOffset(0);
    loadData(false);
  }, [loadData]);

  const handleLoadMore = useCallback(() => {
    loadData(true);
  }, [loadData]);

  /** 엑셀: 마지막 조회 조건의 전체 행을 5,000행씩 받아서 생성 */
  const handleExcelDownload = useCallback(async () => {
    const q = lastQueryRef.current;
    if (!q || !summary || excelProgress) return;
    const EXPORT_PAGE = 5000;
    const fallback = retryMessage("엑셀 파일을 만들지 못했어요.");
    setExcelProgress("엑셀 준비 중...");
    try {
      const all: SalesStatusRow[] = [];
      let off = 0;
      for (;;) {
        let url = `/api/sales-status?export=1&start=${q.startDate}&end=${q.endDate}&salesType=${q.salesType}&offset=${off}&limit=${EXPORT_PAGE}&segment=${encodeURIComponent(q.segment)}`;
        if (q.cardcode) url += `&cardcode=${encodeURIComponent(q.cardcode)}`;
        if (q.sido) url += `&sido=${encodeURIComponent(q.sido)}`;
        if (q.sigun) url += `&sigun=${encodeURIComponent(q.sigun)}`;
        const res = await fetch(url);
        if (!res.ok) throw new UserMessageError(await readApiError(res, fallback));
        const data = await res.json();
        const page = (data.rows ?? []) as SalesStatusRow[];
        all.push(...page);
        off += page.length;
        setExcelProgress(`엑셀 준비 중... ${all.length.toLocaleString()}건`);
        if (data.hasMore !== true || page.length === 0) break;
      }

      setExcelProgress("엑셀 파일 만드는 중...");
      const blob = await buildSalesStatusExcel({
        rows: all,
        summary,
        startDate: q.startDate,
        endDate: q.endDate,
        salesType: q.salesType,
        customerLabel: q.customerLabel,
        regionLabel: [q.sido || "시/도 전체", q.sigun].filter(Boolean).join(" "),
        segmentLabel: SEGMENT_OPTIONS.find((o) => o.value === q.segment)?.label ?? q.segment,
      });
      const defaultName = `거래처현황_판매기준_${q.startDate}_${q.endDate}.xlsx`;

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
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(objUrl);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      await modal.open({ type: "error", message: toUserMessage(e, fallback) });
    } finally {
      setExcelProgress(null);
    }
  }, [summary, excelProgress, modal]);

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
            if (c) searchSeqRef.current++; // 선택 후 도착하는 검색 응답은 무시
            setCustomer(c);
            setOptions([]);
          }}
          options={options}
          onSearchFocus={() => searchCustomers(searchQuery)}
          salesType={salesType}
          onSalesTypeChange={setSalesType}
          sido={sido}
          sigun={sigun}
          onSidoChange={(v) => { setSido(v); setSigun(""); }}
          onSigunChange={setSigun}
          segment={segment}
          onSegmentChange={setSegment}
          onLoad={handleLoad}
          loading={loading}
          onExcelDownload={handleExcelDownload}
          excelDisabled={loading || rows.length === 0 || excelProgress !== null}
          excelLabel={excelProgress ?? undefined}
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
        <div className="mb-4 flex gap-10 px-5 py-3 bg-slate-50 border border-slate-200 rounded-lg">
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
