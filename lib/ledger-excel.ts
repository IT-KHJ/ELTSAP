/**
 * 거래처 거래원장 엑셀 생성 (화면과 동일한 행, 기존 거래원장 엑셀과 같은 컬럼 구성)
 * 금액/수량은 숫자 셀(천 단위 서식)로 기록해 엑셀에서 바로 합계·필터가 가능하도록 함
 */

import ExcelJS from "exceljs";
import type { LedgerResponse } from "@/types/ledger";

const BASE_FONT = { name: "맑은 고딕", size: 10 };
const COLORS = {
  headerBg: "FFF5F6F7",
  border: "FFE5E7EB",
  text: "FF374151",
} as const;
const NUM_FMT = "#,##0";

const COLUMNS: { label: string; width: number; numeric?: boolean }[] = [
  { label: "순번", width: 7 },
  { label: "거래일자", width: 12 },
  { label: "번호", width: 10 },
  { label: "구분", width: 9 },
  { label: "적요사항", width: 40 },
  { label: "수량", width: 9, numeric: true },
  { label: "발생액", width: 14, numeric: true },
  { label: "취소액", width: 14, numeric: true },
  { label: "회수액", width: 14, numeric: true },
  { label: "채권잔액", width: 15, numeric: true },
  { label: "비고", width: 40 },
];

export async function buildLedgerExcel(data: LedgerResponse): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const sheetName = `${data.cardcode}_거래원장`.slice(0, 31);
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 4 }] });

  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
  };
  const titleFont = { ...BASE_FONT, bold: true, color: { argb: COLORS.text } };

  ws.getCell(1, 1).value = `거래처: ${data.cardcode} ${data.cardname}`;
  ws.getCell(1, 1).font = titleFont;
  ws.getCell(2, 1).value = `기간: ${data.startDate} ~ ${data.endDate}`;
  ws.getCell(2, 1).font = titleFont;

  const headerRow = 4;
  COLUMNS.forEach((col, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = col.label;
    cell.font = titleFont;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.border = border;
    cell.alignment = { horizontal: col.numeric ? "right" : "left" };
    ws.getColumn(i + 1).width = col.width;
  });

  let r = headerRow + 1;
  for (const row of data.rows) {
    const isOpening = row.seq === 0;
    const values: (string | number | null)[] = [
      row.seq + 1,
      isOpening ? "전기이월" : row.txdate,
      row.docnum,
      isOpening ? null : row.gubun,
      row.descr,
      row.qty,
      isOpening ? null : row.occur,
      isOpening ? null : row.cancel,
      isOpening ? null : row.collect,
      row.balance,
      row.remark,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v;
      cell.font = BASE_FONT;
      cell.border = border;
      if (COLUMNS[i].numeric) {
        cell.numFmt = NUM_FMT;
        cell.alignment = { horizontal: "right" };
      }
    });
    r++;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
