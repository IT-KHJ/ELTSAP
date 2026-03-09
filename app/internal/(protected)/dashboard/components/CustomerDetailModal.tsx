"use client";

import { formatAmount } from "@/lib/format";
import type { CustomerDetailResponse } from "@/types/dashboard";

interface CustomerDetailModalProps {
  data: CustomerDetailResponse | null;
  loading: boolean;
  onClose: () => void;
}

export function CustomerDetailModal({ data, loading, onClose }: CustomerDetailModalProps) {
  if (!data && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto m-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-12 text-center text-gray-500">로딩 중...</div>
        ) : data ? (
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {data.cardname ?? data.cardcode} 상세 분석
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">기간별 매출 추이</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="report-th py-0.5 px-2">월</th>
                      <th className="report-th py-0.5 px-2">매출</th>
                      <th className="report-th py-0.5 px-2">반품</th>
                      <th className="report-th py-0.5 px-2">순매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="report-td py-4 text-center text-gray-500">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.monthly.map((m) => (
                        <tr key={m.month}>
                          <td className="report-td py-0.5 px-2">{m.month}</td>
                          <td className="report-td report-td-num py-0.5 px-2">{formatAmount(m.sales)}</td>
                          <td className="report-td report-td-num py-0.5 px-2">{formatAmount(m.returns)}</td>
                          <td className="report-td report-td-num py-0.5 px-2">{formatAmount(m.netSales)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">품목별 매출 (상위 30)</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="report-th py-0.5 px-2">품목코드</th>
                      <th className="report-th py-0.5 px-2">품목명</th>
                      <th className="report-th py-0.5 px-2">매출</th>
                      <th className="report-th py-0.5 px-2">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itemSales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="report-td py-4 text-center text-gray-500">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.itemSales.map((i) => (
                        <tr key={i.itemcode}>
                          <td className="report-td py-0.5 px-2">{i.itemcode}</td>
                          <td className="report-td py-0.5 px-2 truncate max-w-[200px]" title={i.itemname ?? ""}>
                            {i.itemname ?? "-"}
                          </td>
                          <td className="report-td report-td-num py-0.5 px-2">{formatAmount(i.sales)}</td>
                          <td className="report-td report-td-num py-0.5 px-2">{i.quantity}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">반품 추이</h3>
              <div className="overflow-x-auto">
                <table className="report-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="report-th py-0.5 px-2">월</th>
                      <th className="report-th py-0.5 px-2">반품액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.returnTrend.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="report-td py-4 text-center text-gray-500">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.returnTrend.map((r) => (
                        <tr key={r.month}>
                          <td className="report-td py-0.5 px-2">{r.month}</td>
                          <td className="report-td report-td-num py-0.5 px-2">{formatAmount(r.returns)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
