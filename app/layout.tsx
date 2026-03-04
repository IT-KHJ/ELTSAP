import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELT 총판 현황",
  description: "거래처 현황 보고서 및 동기화",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
