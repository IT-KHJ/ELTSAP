/**
 * 거래처 현황(판매기준) 엑셀 — 조회 조건의 전체 행(화면에 스크롤로 불러온 행만이 아님)
 * 행이 수십만 건일 수 있어 셀마다 테두리를 넣지 않고 열 단위 서식만 지정한다.
 */

import ExcelJS from "exceljs";
import type { SalesStatusRow, SalesStatusSummary } from "@/types/sales-status";

const BASE_FONT = { name: "맑은 고딕", size: 10 };
const COLORS = {
  headerBg: "FFF5F6F7",
  border: "FFE5E7EB",
  text: "FF374151",
} as const;

const AMOUNT_FMT = "#,##0";

/** 화면(SalesStatusGrid)과 같은 열 */
const COLUMNS: { key: keyof SalesStatusRow; label: string; width: number; numFmt?: string }[] = [
  { key: "docdate", label: "일자", width: 12 },
  { key: "basecard", label: "거래처코드", width: 12 },
  { key: "cardname", label: "거래처명", width: 28 },
  { key: "itemcode", label: "품목번호", width: 16 },
  { key: "itemname", label: "품목명", width: 40 },
  { key: "price", label: "정가", width: 10, numFmt: AMOUNT_FMT },
  { key: "supplyRate", label: "공급율", width: 8, numFmt: "0" },
  { key: "discountRate", label: "할인율", width: 8, numFmt: "0" },
  { key: "quantity", label: "매출수량", width: 10, numFmt: AMOUNT_FMT },
  { key: "salesAmount", label: "매출액", width: 14, numFmt: AMOUNT_FMT },
  { key: "returnAmount", label: "반품액", width: 14, numFmt: AMOUNT_FMT },
  { key: "netSales", label: "순매출", width: 14, numFmt: AMOUNT_FMT },
];

function formatDocdate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v).replace(/\D/g, "");
  if (s.length >= 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return String(v);
}

function salesTypeLabel(salesType: "all" | "sales" | "return"): string {
  if (salesType === "sales") return "판매";
  if (salesType === "return") return "반품";
  return "전체";
}

export interface SalesStatusExcelInput {
  rows: SalesStatusRow[];
  summary: SalesStatusSummary;
  startDate: string;
  endDate: string;
  salesType: "all" | "sales" | "return";
  /** 조회조건 표기용 */
  customerLabel: string;
  regionLabel: string;
  segmentLabel: string;
}

export async function buildSalesStatusExcel(input: SalesStatusExcelInput): Promise<Blob> {
  const { rows, summary, startDate, endDate, salesType, customerLabel, regionLabel, segmentLabel } = input;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("판매기준");
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  const bold = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };

  // 조회조건·합계
  const info: [string, string | number][] = [
    ["기간", `${startDate} ~ ${endDate}`],
    ["거래처", customerLabel],
    ["지역", regionLabel],
    ["판매구분", salesTypeLabel(salesType)],
    ["거래처 구분", segmentLabel],
    ["총 매출", summary.totalSales],
    ["총 반품", summary.totalReturns],
    ["순매출", summary.netSales],
  ];
  info.forEach(([k, v]) => {
    const row = ws.addRow([k, v]);
    row.getCell(1).style = bold;
    row.getCell(2).style = { font: BASE_FONT, numFmt: AMOUNT_FMT, alignment: { horizontal: "left" } };
  });
  ws.addRow([]);

  // 머리글
  const headerRowNo = ws.rowCount + 1;
  const header = ws.addRow(COLUMNS.map((c) => c.label));
  header.eachCell((cell, col) => {
    cell.style = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } },
      font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } },
      alignment: { horizontal: COLUMNS[col - 1].numFmt ? "right" : "left" },
      border: { bottom: { style: "thin", color: { argb: COLORS.border } } },
    };
  });
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];

  // 데이터 (숫자는 숫자로 넣어 엑셀에서 합계·정렬 가능)
  for (const r of rows) {
    const row = ws.addRow(
      COLUMNS.map((c) => {
        const v = r[c.key];
        if (c.key === "docdate") return formatDocdate(v);
        if (v == null) return null;
        return v;
      })
    );
    row.font = BASE_FONT;
    COLUMNS.forEach((c, i) => {
      if (c.numFmt) row.getCell(i + 1).numFmt = c.numFmt;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
