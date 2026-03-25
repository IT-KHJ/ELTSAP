/**
 * 거래처 현황(판매집계) 화면과 동일한 내용의 엑셀 생성
 */

import ExcelJS from "exceljs";
import type { SalesStatusGroupedRow, SalesStatusDetailRow } from "@/lib/sales-status-grouped-queries";
import { formatAmount } from "@/lib/format";

const BASE_FONT = { name: "맑은 고딕", size: 10 };
const COLORS = {
  headerBg: "FFF5F6F7",
  border: "FFE5E7EB",
  text: "FF374151",
} as const;

const DETAIL_KEYS: { key: keyof SalesStatusDetailRow; label: string }[] = [
  { key: "docdate", label: "일자" },
  { key: "itemcode", label: "품목번호" },
  { key: "itemname", label: "품목명" },
  { key: "price", label: "정가" },
  { key: "supplyRate", label: "공급율" },
  { key: "discountRate", label: "할인율" },
  { key: "quantity", label: "매출수량" },
  { key: "salesAmount", label: "매출액" },
  { key: "vatAmount", label: "세액" },
  { key: "totalAmount", label: "총금액" },
  { key: "returnAmount", label: "반품액" },
  { key: "netSales", label: "순매출" },
];

function formatDocdate(v: unknown): string {
  if (v == null || v === "") return "-";
  const s = String(v).replace(/-/g, "").replace(/\D/g, "");
  if (s.length >= 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return String(v);
}

function formatDetailCell(row: SalesStatusDetailRow, key: keyof SalesStatusDetailRow): string {
  const v = row[key];
  if (v == null) return "-";
  if (key === "docdate") return formatDocdate(v);
  if (typeof v === "number") {
    if (
      key === "price" ||
      key === "salesAmount" ||
      key === "vatAmount" ||
      key === "totalAmount" ||
      key === "returnAmount" ||
      key === "netSales"
    ) {
      return formatAmount(v);
    }
    return String(v);
  }
  return String(v);
}

function salesTypeLabel(salesType: "all" | "sales" | "return"): string {
  if (salesType === "sales") return "판매";
  if (salesType === "return") return "반품";
  return "전체";
}

export interface SalesStatusGroupedExcelInput {
  groupedRows: SalesStatusGroupedRow[];
  startDate: string;
  endDate: string;
  salesType: "all" | "sales" | "return";
  summary: { totalSales: number; totalReturns: number; netSales: number };
  expandedBasecards: ReadonlySet<string>;
  detailRows: Record<string, SalesStatusDetailRow[]>;
  detailLoading: Record<string, boolean>;
}

export async function buildSalesStatusGroupedExcel(input: SalesStatusGroupedExcelInput): Promise<Blob> {
  const {
    groupedRows,
    startDate,
    endDate,
    salesType,
    summary,
    expandedBasecards,
    detailRows,
    detailLoading,
  } = input;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("판매집계", { views: [{ state: "frozen", ySplit: 1 }] });

  const headerStyle = {
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.headerBg } },
    font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } },
    alignment: { horizontal: "left" as const },
    border: {
      bottom: { style: "thin" as const, color: { argb: COLORS.border } },
    },
  };

  const baseBorder: Partial<ExcelJS.Style> = {
    font: BASE_FONT,
    border: {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
    },
  };

  let r = 1;
  ws.getCell(r, 1).value = `기간: ${startDate} ~ ${endDate}`;
  ws.getCell(r, 1).style = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };
  r++;
  ws.getCell(r, 1).value = `판매구분: ${salesTypeLabel(salesType)}`;
  ws.getCell(r, 1).style = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };
  r += 2;

  ws.getCell(r, 1).value = "총 매출";
  ws.getCell(r, 2).value = formatAmount(summary.totalSales);
  ws.getCell(r, 1).style = { ...baseBorder, ...headerStyle };
  ws.getCell(r, 2).style = { ...baseBorder, alignment: { horizontal: "right" } };
  r++;
  ws.getCell(r, 1).value = "총 반품";
  ws.getCell(r, 2).value = formatAmount(summary.totalReturns);
  ws.getCell(r, 1).style = { ...baseBorder, ...headerStyle };
  ws.getCell(r, 2).style = { ...baseBorder, alignment: { horizontal: "right" } };
  r++;
  ws.getCell(r, 1).value = "순매출";
  ws.getCell(r, 2).value = formatAmount(summary.netSales);
  ws.getCell(r, 1).style = { ...baseBorder, ...headerStyle };
  ws.getCell(r, 2).style = { ...baseBorder, alignment: { horizontal: "right" } };
  r += 2;

  const groupHeaders = [
    "거래처코드",
    "거래처명",
    "매출수량",
    "매출금액",
    "세액",
    "총금액",
    "반품금액",
  ];
  groupHeaders.forEach((h, c) => {
    const cell = ws.getCell(r, c + 1);
    cell.value = h;
    cell.style = { ...headerStyle, ...baseBorder, alignment: { horizontal: c >= 2 ? "right" : "left" } };
  });
  r++;

  for (const g of groupedRows) {
    ws.getCell(r, 1).value = g.basecard;
    ws.getCell(r, 1).style = { ...baseBorder, alignment: { horizontal: "left" } };
    ws.getCell(r, 2).value = g.cardname ?? "-";
    ws.getCell(r, 2).style = { ...baseBorder, alignment: { horizontal: "left" } };
    ws.getCell(r, 3).value = formatAmount(g.quantity);
    ws.getCell(r, 3).style = { ...baseBorder, alignment: { horizontal: "right" } };
    ws.getCell(r, 4).value = formatAmount(g.salesAmount);
    ws.getCell(r, 4).style = { ...baseBorder, alignment: { horizontal: "right" } };
    ws.getCell(r, 5).value = formatAmount(g.vatAmount);
    ws.getCell(r, 5).style = { ...baseBorder, alignment: { horizontal: "right" } };
    ws.getCell(r, 6).value = formatAmount(g.totalAmount);
    ws.getCell(r, 6).style = { ...baseBorder, alignment: { horizontal: "right" } };
    ws.getCell(r, 7).value = formatAmount(g.returnAmount);
    ws.getCell(r, 7).style = { ...baseBorder, alignment: { horizontal: "right" } };
    r++;

    if (expandedBasecards.has(g.basecard)) {
      if (detailLoading[g.basecard]) {
        ws.getCell(r, 1).value = "로딩 중...";
        ws.getCell(r, 1).style = { ...baseBorder, font: { ...BASE_FONT, italic: true } };
        r++;
      } else {
        const dRows = detailRows[g.basecard] ?? [];
        DETAIL_KEYS.forEach((col, c) => {
          const cell = ws.getCell(r, c + 1);
          cell.value = col.label;
          cell.style = {
            ...headerStyle,
            ...baseBorder,
            alignment: { horizontal: c >= 3 ? "right" : "left" },
          };
        });
        r++;

        for (const row of dRows) {
          DETAIL_KEYS.forEach((col, c) => {
            const cell = ws.getCell(r, c + 1);
            cell.value = formatDetailCell(row, col.key);
            cell.style = {
              ...baseBorder,
              alignment: { horizontal: c >= 3 ? "right" : "left" },
            };
          });
          r++;
        }
      }
    }
  }

  for (let c = 1; c <= 12; c++) {
    ws.getColumn(c).width = c <= 2 ? 16 : c <= 7 ? 14 : 12;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
