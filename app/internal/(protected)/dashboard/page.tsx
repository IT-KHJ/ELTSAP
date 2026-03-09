"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useModal } from "@/lib/components/ModalProvider";
import { DashboardFilter, type CustomerOption } from "./components/DashboardFilter";
import { ExecutiveSummary } from "./components/ExecutiveSummary";
import { RankingTable } from "./components/RankingTable";
import { CustomerDetailModal } from "./components/CustomerDetailModal";
import { ParetoSection } from "./components/ParetoSection";
import { InsightsSection } from "./components/InsightsSection";
import type {
  DashboardSummary,
  DashboardRankingResponse,
  CustomerDetailResponse,
  CustomerRankingRow,
  DashboardInsightsResponse,
  ParetoRow,
} from "@/types/dashboard";

/** report page getDefaultPeriod와 동일 */
function getDefaultPeriod() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (currentMonth === 1) {
    return { startYear: currentYear - 1, startMonth: 1, endYear: currentYear - 1, endMonth: 12 };
  }
  return {
    startYear: currentYear,
    startMonth: 1,
    endYear: currentYear,
    endMonth: currentMonth - 1,
  };
}

function DashboardContent() {
  const modal = useModal();
  const searchParams = useSearchParams();
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);

  const [startYear, setStartYear] = useState(defaultPeriod.startYear);
  const [startMonth, setStartMonth] = useState(defaultPeriod.startMonth);
  const [endYear, setEndYear] = useState(defaultPeriod.endYear);
  const [endMonth, setEndMonth] = useState(defaultPeriod.endMonth);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("전체");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [ranking, setRanking] = useState<DashboardRankingResponse | null>(null);
  const [pareto, setPareto] = useState<{ rows: ParetoRow[] } | null>(null);
  const [insights, setInsights] = useState<DashboardInsightsResponse | null>(null);
  const [rankingPage, setRankingPage] = useState(1);
  const [rankingSortBy, setRankingSortBy] = useState("sales");
  const [rankingOrder, setRankingOrder] = useState<"asc" | "desc">("desc");
  const [detailCardcode, setDetailCardcode] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CustomerDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const start = `${startYear}-${String(startMonth).padStart(2, "0")}`;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}`;

  const searchCustomers = useCallback(async (q: string) => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q.trim())}`);
    const list = (await res.json()) as CustomerOption[];
    setOptions(list);
  }, []);

  /** report page loadReport 패턴: 클릭 시점 state에서 start/end 직접 계산. 정렬/페이지는 overrides로 전달 */
  const loadDashboard = useCallback(
    async (overrides?: { sortBy?: string; order?: "asc" | "desc"; page?: number }) => {
      setLoading(true);
      try {
        const startParam = `${startYear}-${String(startMonth).padStart(2, "0")}`;
        const endParam = `${endYear}-${String(endMonth).padStart(2, "0")}`;
        const cardParam = customer?.cardcode;
        const sortBy = overrides?.sortBy ?? rankingSortBy;
        const order = overrides?.order ?? rankingOrder;
        const page = overrides?.page ?? rankingPage;

        const fetchOpts: RequestInit = { cache: "no-store" };
        const [summaryRes, rankingRes, paretoRes, insightsRes] = await Promise.all([
          fetch(`/api/dashboard/summary?start=${startParam}&end=${endParam}`, fetchOpts),
          fetch(
            `/api/dashboard/ranking?start=${startParam}&end=${endParam}&sortBy=${sortBy}&order=${order}&page=${page}&limit=10${cardParam ? `&cardcode=${encodeURIComponent(cardParam)}` : ""}`,
            fetchOpts
          ),
          fetch(`/api/dashboard/pareto?start=${startParam}&end=${endParam}`, fetchOpts),
          fetch(`/api/dashboard/insights?start=${startParam}&end=${endParam}`, fetchOpts),
        ]);

        if (!summaryRes.ok) throw new Error(await summaryRes.text());
        if (!rankingRes.ok) throw new Error(await rankingRes.text());
        if (!paretoRes.ok) throw new Error(await paretoRes.text());
        if (!insightsRes.ok) throw new Error(await insightsRes.text());

        const [s, r, p, i] = await Promise.all([
          summaryRes.json(),
          rankingRes.json(),
          paretoRes.json(),
          insightsRes.json(),
        ]);
        setSummary(s);
        setRanking(r);
        setPareto(p);
        setInsights(i);
      } catch (e) {
        await modal.open({
          type: "error",
          message: e instanceof Error ? e.message : "대시보드 조회 실패",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      startYear,
      startMonth,
      endYear,
      endMonth,
      customer?.cardcode,
      rankingSortBy,
      rankingOrder,
      rankingPage,
      modal,
    ]
  );

  const handleRankingSort = useCallback(
    (col: string) => {
      const newOrder = rankingOrder === "desc" ? "asc" : "desc";
      setRankingSortBy(col);
      setRankingOrder(newOrder);
      setRankingPage(1);
      loadDashboard({ sortBy: col, order: newOrder, page: 1 });
    },
    [rankingOrder, loadDashboard]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setRankingPage(page);
      loadDashboard({ page });
    },
    [loadDashboard]
  );

  const handleRowClick = useCallback(async (row: CustomerRankingRow) => {
    setDetailCardcode(row.cardcode);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/customer/${encodeURIComponent(row.cardcode)}?start=${start}&end=${end}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as CustomerDetailResponse;
      setDetailData(data);
    } catch (e) {
      await modal.open({
        type: "error",
        message: e instanceof Error ? e.message : "상세 조회 실패",
      });
      setDetailCardcode(null);
    } finally {
      setDetailLoading(false);
    }
  }, [start, end, modal]);

  const handleInsightCustomerClick = useCallback(
    (cardcode: string) => {
      handleRowClick({
        cardcode,
        cardname: null,
        aliasname: null,
        sales: 0,
        netSales: 0,
        returns: 0,
        returnRate: 0,
        orderCount: 0,
        sharePercent: 0,
        yoy: "-",
        mom: "-",
        rank: 0,
      });
    },
    [handleRowClick]
  );

  useEffect(() => {
    const q = searchParams.get("cardcode");
    if (q?.trim() && detailCardcode !== q.trim()) {
      setDetailCardcode(q.trim());
      setDetailData(null);
      setDetailLoading(true);
      fetch(`/api/dashboard/customer/${encodeURIComponent(q.trim())}?start=${start}&end=${end}`)
        .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error(await res.text()))))
        .then((data: CustomerDetailResponse) => setDetailData(data))
        .catch(() => setDetailCardcode(null))
        .finally(() => setDetailLoading(false));
    }
  }, [searchParams, start, end]);

  return (
    <div className="dashboard-page">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">거래처 매출 대시보드</h1>

      <div className="mb-2">
        <DashboardFilter
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
          onLoad={loadDashboard}
          loading={loading}
          hasData={!!summary}
        />
      </div>

      {summary && <ExecutiveSummary data={summary} />}
      {ranking && (
        <RankingTable
          rows={ranking.rows}
          totalCount={ranking.totalCount}
          page={ranking.page}
          limit={ranking.limit}
          sortBy={rankingSortBy}
          order={rankingOrder}
          onSort={handleRankingSort}
          onPageChange={handlePageChange}
          onRowClick={handleRowClick}
        />
      )}
      {pareto?.rows && <ParetoSection rows={pareto.rows} />}
      {insights && <InsightsSection data={insights} onCustomerClick={handleInsightCustomerClick} />}

      <CustomerDetailModal
        data={detailData}
        loading={detailLoading}
        onClose={() => {
          setDetailCardcode(null);
          setDetailData(null);
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">로딩 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
