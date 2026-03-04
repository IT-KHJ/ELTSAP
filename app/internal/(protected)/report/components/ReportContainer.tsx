interface ReportContainerProps {
  children: React.ReactNode;
}

export function ReportContainer({ children }: ReportContainerProps) {
  return (
    <div className="mt-5 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {children}
    </div>
  );
}
