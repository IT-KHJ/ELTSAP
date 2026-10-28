"use client";

import { useState } from "react";
import { formatAmount } from "@/lib/format";
import type { LedgerRow } from "@/types/ledger";

/** 화면에 한 번에 그리는 행 수 (전체 기간 조회 시 수만 행 → 나눠서 표시, 엑셀에는 전체 포함) */
const RENDER_STEP = 1000;

const HEADERS: { label: string; align?: "right"; minWidth?: string }[] = [
  { label: "순번", align: "right", minWidth: "3.5rem" },
  { label: "거래일자", minWidth: "6rem" },
  { label: "번호", minWidth: "5rem" },
  { label: "구분", minWidth: "4.5rem" },
  { label: "적요사항", minWidth: "16rem" },
  { label: "수량", align: "right", minWidth: "4rem" },
  { label: "발생액", align: "right", minWidth: "7rem" },
  { label: "취소액", align: "right", minWidth: "7rem" },
  { label: "회수액", align: "right", minWidth: "7rem" },
  { label: "채권잔액", align: "right", minWidth: "8rem" },
  { label: "비고", minWidth: "14rem" },
];

const amount = (v: number) => (v === 0 ? "" : formatAmount(v));

export function LedgerGrid({ rows }: { rows: LedgerRow[] }) {
  const [limit, setLimit] = useState(RENDER_STEP);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        거래처와 기간을 선택한 뒤 조회하세요.
      </div>
    );
  }

  const visible = rows.slice(0, limit);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth: "max-content" }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {HEADERS.map(({ label, align, minWidth }) => (
              <th
                key={label}
                className={`px-3 py-2 font-medium text-gray-700 whitespace-nowrap ${align === "right" ? "text-right" : "text-left"}`}
                style={{ minWidth }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const isOpening = r.seq === 0;
            return (
              <tr key={r.seq} className={`border-b border-gray-100 hover:bg-gray-50 ${isOpening ? "bg-slate-50 font-medium" : ""}`}>
                <td className="px-3 py-2 text-right tabular-nums">{r.seq + 1}</td>
                <td className="px-3 py-2 whitespace-nowrap">{isOpening ? "전기이월" : r.txdate}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.docnum ?? ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">{isOpening ? "" : r.gubun}</td>
                <td className="px-3 py-2 max-w-[24rem] truncate" title={r.descr ?? ""}>{r.descr ?? ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.qty == null || r.qty === 0 ? "" : formatAmount(r.qty)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{amount(r.occur)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{amount(r.cancel)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{amount(r.collect)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatAmount(r.balance)}</td>
                <td className="px-3 py-2 max-w-[20rem] truncate" title={r.remark ?? ""}>{r.remark ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <div className="py-3 flex items-center justify-center gap-3 bg-gray-50 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {limit.toLocaleString("ko-KR")} / {rows.length.toLocaleString("ko-KR")}행 표시 중 (엑셀에는 전체 포함)
          </span>
          <button
            type="button"
            onClick={() => setLimit((n) => n + RENDER_STEP)}
            className="h-8 px-4 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
