"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface MaintenanceData {
  content: string | null;
  time_from: string | null;
  time_to: string | null;
}

function formatDateTime(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return "";
  if (from && to) {
    const dFrom = new Date(from);
    const dTo = new Date(to);
    return `${formatDateTime(dFrom)} ~ ${formatDateTime(dTo)}`;
  }
  if (from) {
    return `${formatDateTime(new Date(from))}부터`;
  }
  return `${formatDateTime(new Date(to!))}까지`;
}

export default function MaintenancePage() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/maintenance")
      .then((res) => res.json())
      .then((json) => {
        setData({
          content: json.content ?? null,
          time_from: json.time_from ?? null,
          time_to: json.time_to ?? null,
        });
      })
      .catch(() => setData({ content: null, time_from: null, time_to: null }))
      .finally(() => setLoading(false));
  }, []);

  const dateRange = data ? formatDateRange(data.time_from, data.time_to) : "";
  const hasDateRange = !!dateRange;
  const hasContent = !!(data?.content?.trim());
  const hasDetails = hasDateRange || hasContent;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        {/* 상단 블루 영역 - NE능률 CI + 타이틀 */}
        <div className="bg-[#1e40af] px-6 py-8 relative overflow-hidden">
          {/* 배경 패턴 (은은한 원형) */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
            <div className="absolute top-[15%] left-[10%] w-6 h-6 rounded-full border-2 border-white" />
            <div className="absolute top-[20%] right-[12%] w-4 h-4 rounded-full border-2 border-white" />
            <div className="absolute top-[45%] left-[8%] w-5 h-5 rounded-full border-2 border-white" />
            <div className="absolute top-[50%] right-[10%] w-4 h-4 rounded-full border-2 border-white" />
            <div className="absolute top-[75%] left-[12%] w-5 h-5 rounded-full border-2 border-white" />
            <div className="absolute top-[70%] right-[15%] w-4 h-4 rounded-full border-2 border-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 rounded-full bg-white/80 p-4 flex items-center justify-center">
              <Image
                src="/ne-ci-logo.png"
                alt="NE능률"
                width={72}
                height={48}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-xl font-bold text-white text-center">
              사이트 점검중입니다.
            </h1>
          </div>
        </div>

        {/* 하단 화이트 영역 */}
        <div className="bg-white px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-gray-800 text-sm leading-relaxed mb-5">
                보다 나은 서비스를 제공해 드리기 위하여 아래와 같이
                <br />
                서버 점검을 실시합니다.
                <br />
                고객 여러분의 많은 양해와 부탁드립니다.
              </p>

              {hasDetails ? (
                <div className="space-y-3">
                  {hasDateRange && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-teal-500 text-white text-xs font-medium w-fit shrink-0">
                        일시
                      </span>
                      <span className="text-[#c026d3] font-medium text-sm">
                        {dateRange}
                      </span>
                    </div>
                  )}
                  {hasContent && (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-teal-500 text-white text-xs font-medium w-fit shrink-0">
                        내용
                      </span>
                      <span className="text-gray-800 text-sm leading-relaxed">
                        {data!.content}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-2" aria-hidden />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
