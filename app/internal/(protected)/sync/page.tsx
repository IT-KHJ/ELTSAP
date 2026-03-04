"use client";

import { useState } from "react";

const SYNC_ITEMS = [
  { label: "거래처 동기화", path: "/api/sync/customer/run" },
  { label: "품목 동기화", path: "/api/sync/itemlist/run" },
  { label: "매출 동기화", path: "/api/sync/sales/run" },
  { label: "입금 동기화", path: "/api/sync/inamt/run" },
  { label: "기타출고 동기화", path: "/api/sync/saleetc/run" },
] as const;

export default function SyncPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const runSync = async (label: string, path: string) => {
    setLoading(label);
    setProgress(0);
    setResult((r) => ({ ...r, [label]: { ok: false, msg: "진행 중..." } }));
    try {
      const res = await fetch(path, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.success;
      const msg = data?.error ?? (ok ? `반영: ${data?.inserted ?? 0}건` : `오류: ${res.status}`);
      setResult((r) => ({ ...r, [label]: { ok, msg } }));
    } catch (e) {
      setResult((r) => ({ ...r, [label]: { ok: false, msg: String(e) } }));
    } finally {
      setProgress(100);
      setLoading(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">동기화</h1>
      <p className="text-gray-600 mb-6">
        각 버튼을 누르면 설정된 동기화 소스 URL에서 데이터를 가져와 Supabase에 반영합니다.
        <br />
        <small className="text-gray-500">SYNC_*_URL 환경 변수가 없으면 해당 항목은 실행되지 않습니다.</small>
      </p>
      <div className="flex flex-col gap-3 max-w-md">
        {SYNC_ITEMS.map(({ label, path }) => (
          <div key={label} className="flex items-center gap-3">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => runSync(label, path)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading === label ? "처리 중..." : label}
            </button>
            {loading === label && (
              <span className="text-sm text-gray-600">{progress}%</span>
            )}
            {result[label] && loading !== label && (
              <span className={`text-sm ${result[label].ok ? "text-green-600" : "text-red-600"}`}>
                {result[label].msg}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
