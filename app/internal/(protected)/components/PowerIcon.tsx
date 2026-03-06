/** 전원 아이콘 (다크블루, 미니멀) */
export function PowerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 상단 세로선 (원 상단 ~ 중심) */}
      <path
        d="M12 6v6"
        stroke="#2F3D4D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 하단 원호 (상단에 틈) */}
      <path
        d="M 15 6.8 A 6 6 0 1 1 9 6.8"
        stroke="#2F3D4D"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
