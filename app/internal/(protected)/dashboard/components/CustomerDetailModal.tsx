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
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-700 border-b border-gray-200">월</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">매출</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">반품</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">순매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500 border-b border-gray-200">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      <>
                        {data.monthly.map((m) => (
                          <tr key={m.month} className="hover:bg-gray-50/50">
                            <td className="py-2 px-3 text-gray-900 border-b border-gray-200">{m.month}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{formatAmount(m.sales)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{formatAmount(m.returns)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{formatAmount(m.netSales)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold bg-gray-100">
                          <td className="py-2.5 px-3 text-gray-900 border-b border-gray-300">합계</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 border-b border-gray-300">
                            {formatAmount(data.monthly.reduce((s, m) => s + m.sales, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 border-b border-gray-300">
                            {formatAmount(data.monthly.reduce((s, m) => s + m.returns, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-gray-900 border-b border-gray-300">
                            {formatAmount(data.monthly.reduce((s, m) => s + m.netSales, 0))}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">품목별 매출 (상위 30)</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-700 border-b border-gray-200">품목코드</th>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-700 border-b border-gray-200">품목명</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">매출</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itemSales.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500 border-b border-gray-200">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.itemSales.map((i) => (
                        <tr key={i.itemcode} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3 text-gray-900 border-b border-gray-200">{i.itemcode}</td>
                          <td className="py-2 px-3 truncate max-w-[200px] text-gray-700 border-b border-gray-200" title={i.itemname ?? ""}>
                            {i.itemname ?? "-"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{formatAmount(i.sales)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{i.quantity}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">품목별 반품 (상위 30)</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-700 border-b border-gray-200">품목코드</th>
                      <th className="py-2.5 px-3 text-left font-semibold text-gray-700 border-b border-gray-200">품목명</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">반품</th>
                      <th className="py-2.5 px-3 text-right font-semibold text-gray-700 border-b border-gray-200">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.itemReturns.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500 border-b border-gray-200">
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      data.itemReturns.map((i) => (
                        <tr key={i.itemcode} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3 text-gray-900 border-b border-gray-200">{i.itemcode}</td>
                          <td className="py-2 px-3 truncate max-w-[200px] text-gray-700 border-b border-gray-200" title={i.itemname ?? ""}>
                            {i.itemname ?? "-"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{formatAmount(i.returns)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-gray-700 border-b border-gray-200">{i.quantity}</td>
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
