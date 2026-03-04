interface ReportHeaderProps {
  title: string;
  cardname?: string | null;
  periodLabel?: string;
}

export function ReportHeader({ title, cardname, periodLabel }: ReportHeaderProps) {
  return (
    <header className="px-5 py-5 border-b border-gray-200 bg-gray-50/80">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <div className="flex flex-col items-end gap-0.5 text-sm text-gray-600">
          <span>거래처명 {cardname ?? "—"}</span>
          <span>조회기간 {periodLabel ?? "—"}</span>
        </div>
      </div>
    </header>
  );
}
