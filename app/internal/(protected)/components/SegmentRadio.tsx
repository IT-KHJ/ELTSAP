"use client";

import { SEGMENT_OPTIONS, type Segment } from "@/lib/constants";

/** 조회조건 "거래처 구분" 라디오 (전체 / ELT / 중고등) */
export function SegmentRadio({ value, onChange }: { value: Segment; onChange: (v: Segment) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">거래처 구분</label>
      <div className="flex items-center gap-4 flex-wrap">
        {SEGMENT_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="segment"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
