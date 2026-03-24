/**
 * 거래처 현황 보고서 → 엑셀 다운로드 (화면과 동일한 스타일)
 * 독립 모듈: 이 파일만 제거/비활성화해도 다른 소스에 영향 없음
 */

import ExcelJS from "exceljs";
import type { ReportData } from "@/types/report";
import { formatAmount, formatChangePercent } from "@/lib/format";
import { MONTHS, CATEGORY_BG, CATEGORY_OUP } from "@/lib/constants";

const COLORS = {
  headerBg: "FFF5F6F7",
  border: "FFE5E7EB",
  bgBg: "FFFEF3F2",
  bgOup: "FFF0F9FF",
  rowEven: "FFFAFAFA",
  increase: "FFDC2626",
  decrease: "FF2563EB",
  text: "FF374151",
} as const;

const BASE_FONT = { name: "맑은 고딕", size: 10 };

function parseMonth(dateStr: string): number {
  const parts = dateStr.split("-");
  const m = parseInt(parts[1] ?? "1", 10);
  return m >= 1 && m <= 12 ? m : 1;
}

function getChangeText(current: number, previous: number, invertForNegative = true): string {
  const { text, isIncrease } = formatChangePercent(current, previous, { invertForNegative });
  if (text === "-") return "-";
  const arrow = isIncrease === true ? "▲" : isIncrease === false ? "▼" : "";
  return `${arrow}${text}`;
}

function getChangeStyle(current: number, previous: number, invertForNegative = true) {
  const { text, isIncrease } = formatChangePercent(current, previous, { invertForNegative });
  if (text === "-") return { font: { ...BASE_FONT, color: { argb: COLORS.text } } };
  return {
    font: {
      ...BASE_FONT,
      color: { argb: isIncrease === true ? COLORS.increase : isIncrease === false ? COLORS.decrease : COLORS.text },
    },
  };
}

export async function buildReportExcel(data: ReportData): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("거래처현황", { views: [{ state: "frozen", ySplit: 1 }] });

  const prevPeriodShort = `${data.previousStartDate.slice(0, 4)}년 ${parseMonth(data.previousStartDate)}월~${parseMonth(data.previousEndDate)}월`;
  const currPeriodShort = `${data.startDate.slice(0, 4)}년 ${parseMonth(data.startDate)}월~${parseMonth(data.endDate)}월`;
  const prevYearLabel = `${data.previousStartDate.slice(0, 4)}년`;
  const currYearLabel = `${data.startDate.slice(0, 4)}년`;

  const headerStyle = {
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.headerBg } },
    font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } },
    alignment: { horizontal: "center" as const },
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

  let row = 1;

  // 총판명
  ws.getCell(row, 1).value = `총판명 : ${data.cardname}`;
  ws.getCell(row, 1).style = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };
  row += 2;

  // KPI 요약 테이블
  const kpiHeaders = ["구분", prevPeriodShort, currPeriodShort, "증감"];
  kpiHeaders.forEach((h, c) => {
    const cell = ws.getCell(row, c + 1);
    cell.value = h;
    cell.style = { ...headerStyle, ...baseBorder };
  });
  row++;

  const summaryChangeStyle = data.summary.changePercent.startsWith("-")
    ? { font: { ...BASE_FONT, color: { argb: COLORS.decrease } } }
    : { font: { ...BASE_FONT, color: { argb: COLORS.increase } } };
  const returnChangeStyle = data.summary.returnChangePercent.startsWith("-")
    ? { font: { ...BASE_FONT, color: { argb: COLORS.decrease } } }
    : { font: { ...BASE_FONT, color: { argb: COLORS.increase } } };

  ws.getCell(row, 1).value = "매출";
  ws.getCell(row, 1).style = baseBorder;
  ws.getCell(row, 2).value = formatAmount(data.summary.totalPrevious);
  ws.getCell(row, 2).style = { ...baseBorder, alignment: { horizontal: "right" } };
  ws.getCell(row, 3).value = formatAmount(data.summary.totalCurrent);
  ws.getCell(row, 3).style = { ...baseBorder, alignment: { horizontal: "right" } };
  ws.getCell(row, 4).value = `${data.summary.changePercent !== "-" ? (data.summary.changePercent.includes("-") ? "▼" : "▲") : ""}${data.summary.changePercent}`;
  ws.getCell(row, 4).style = { ...baseBorder, ...summaryChangeStyle, alignment: { horizontal: "center" } };
  row++;

  ws.getCell(row, 1).value = "반품";
  ws.getCell(row, 1).style = baseBorder;
  ws.getCell(row, 2).value = formatAmount(data.summary.returnTotalPrevious);
  ws.getCell(row, 2).style = { ...baseBorder, alignment: { horizontal: "right" } };
  ws.getCell(row, 3).value = formatAmount(data.summary.returnTotalCurrent);
  ws.getCell(row, 3).style = { ...baseBorder, alignment: { horizontal: "right" } };
  ws.getCell(row, 4).value = `${data.summary.returnChangePercent !== "-" ? (data.summary.returnChangePercent.includes("-") ? "▼" : "▲") : ""}${data.summary.returnChangePercent}`;
  ws.getCell(row, 4).style = { ...baseBorder, ...returnChangeStyle, alignment: { horizontal: "center" } };
  row += 2;

  // 매출 채권 현황
  ws.getCell(row, 1).value = "■ 매출 채권 현황";
  ws.getCell(row, 1).style = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };
  row += 2;

  const monthHeaders = ["", "구분", ...MONTHS.map((m) => `${m}월`), "Total"];
  monthHeaders.forEach((h, c) => {
    const cell = ws.getCell(row, c + 1);
    cell.value = h;
    cell.style = { ...headerStyle, ...baseBorder };
  });
  row++;

  const addCategoryRows = (
    categoryLabel: string,
    prevData: Record<string, number>,
    currData: Record<string, number>,
    bgColor: string,
    isReturn = false
  ) => {
    const evenBg = { fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: bgColor } } };
    const renderChange = isReturn ? (a: number, b: number) => getChangeText(a, b, false) : (a: number, b: number) => getChangeText(a, b);
    const getChangeCellStyle = isReturn
      ? (a: number, b: number) => getChangeStyle(a, b, false)
      : (a: number, b: number) => getChangeStyle(a, b);

    const startRow = row;

    // N년
    ws.getCell(row, 1).value = categoryLabel;
    ws.getCell(row, 1).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "center", vertical: "middle" }, font: { ...BASE_FONT, bold: true } };
    ws.getCell(row, 2).value = `${data.previousStartDate.slice(0, 4)}년`;
    ws.getCell(row, 2).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "left" } };
    MONTHS.forEach((m, i) => {
      const cell = ws.getCell(row, i + 3);
      cell.value = formatAmount(prevData[String(m)]);
      cell.style = { ...baseBorder, ...evenBg, alignment: { horizontal: "right" } };
    });
    ws.getCell(row, 15).value = formatAmount(prevData.total);
    ws.getCell(row, 15).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "right" } };
    row++;

    // N년 (현재)
    ws.getCell(row, 2).value = `${data.startDate.slice(0, 4)}년`;
    ws.getCell(row, 2).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "left" }, font: { ...BASE_FONT, bold: true } };
    MONTHS.forEach((m, i) => {
      const cell = ws.getCell(row, i + 3);
      cell.value = formatAmount(currData[String(m)]);
      cell.style = { ...baseBorder, ...evenBg, alignment: { horizontal: "right" } };
    });
    ws.getCell(row, 15).value = formatAmount(currData.total);
    ws.getCell(row, 15).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "right" } };
    row++;

    // 증감
    ws.getCell(row, 2).value = "증감";
    ws.getCell(row, 2).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "left" }, font: { ...BASE_FONT, bold: true } };
    MONTHS.forEach((m, i) => {
      const cell = ws.getCell(row, i + 3);
      const curr = currData[String(m)] ?? 0;
      const prev = prevData[String(m)] ?? 0;
      cell.value = renderChange(curr, prev);
      cell.style = { ...baseBorder, ...evenBg, alignment: { horizontal: "right" }, ...getChangeCellStyle(curr, prev) };
    });
    ws.getCell(row, 15).value = renderChange(currData.total, prevData.total);
    ws.getCell(row, 15).style = {
      ...baseBorder,
      ...evenBg,
      alignment: { horizontal: "right" },
      ...getChangeCellStyle(currData.total, prevData.total),
    };
    ws.mergeCells(startRow, 1, row, 1);
    row++;
  };

  // B&G 매출
  for (const cat of data.salesByCategory.filter((c) => c.categoryCode === CATEGORY_BG)) {
    addCategoryRows(
      cat.categoryLabel,
      cat.previousYear as unknown as Record<string, number>,
      cat.currentYear as unknown as Record<string, number>,
      COLORS.bgBg,
      false
    );
  }
  row++; // spacer

  // OUP 매출
  for (const cat of data.salesByCategory.filter((c) => c.categoryCode === CATEGORY_OUP)) {
    addCategoryRows(
      cat.categoryLabel,
      cat.previousYear as unknown as Record<string, number>,
      cat.currentYear as unknown as Record<string, number>,
      COLORS.bgOup,
      false
    );
  }
  row++;

  // B&G 반품
  for (const cat of data.returnsByCategory.filter((c) => c.categoryCode === CATEGORY_BG)) {
    addCategoryRows(
      cat.categoryLabel,
      cat.previousYear as unknown as Record<string, number>,
      cat.currentYear as unknown as Record<string, number>,
      COLORS.bgBg,
      true
    );
  }

  // OUP 반품
  for (const cat of data.returnsByCategory.filter((c) => c.categoryCode === CATEGORY_OUP)) {
    addCategoryRows(
      cat.categoryLabel,
      cat.previousYear as unknown as Record<string, number>,
      cat.currentYear as unknown as Record<string, number>,
      COLORS.bgOup,
      true
    );
  }
  row++;

  // 채권 (3행: 요청금액, 실제 입금액, 회수율)
  const inamtBg = { fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.rowEven } } };
  const inamtStartRow = row;
  ws.getCell(row, 1).value = "채권";
  ws.getCell(row, 1).style = { ...baseBorder, ...inamtBg, alignment: { horizontal: "center", vertical: "middle" }, font: { ...BASE_FONT, bold: true } };
  ws.getCell(row, 2).value = "요청금액";
  ws.getCell(row, 2).style = { ...baseBorder, ...inamtBg };
  for (let c = 3; c <= 15; c++) ws.getCell(row, c).style = { ...baseBorder, ...inamtBg };
  row++;
  ws.getCell(row, 2).value = "실제 입금액";
  ws.getCell(row, 2).style = { ...baseBorder, ...inamtBg, font: { ...BASE_FONT, bold: true } };
  MONTHS.forEach((m, i) => {
    const cell = ws.getCell(row, i + 3);
    cell.value = formatAmount((data.inamt.currentYear as unknown as Record<string, number>)[String(m)]);
    cell.style = { ...baseBorder, ...inamtBg, alignment: { horizontal: "right" } };
  });
  ws.getCell(row, 15).value = formatAmount(data.inamt.currentYear.total);
  ws.getCell(row, 15).style = { ...baseBorder, ...inamtBg, alignment: { horizontal: "right" } };
  row++;
  ws.getCell(row, 2).value = "회수율";
  ws.getCell(row, 2).style = { ...baseBorder, ...inamtBg };
  for (let c = 3; c <= 15; c++) ws.getCell(row, c).style = { ...baseBorder, ...inamtBg };
  ws.mergeCells(inamtStartRow, 1, row, 1);
  row += 2;

  // 증정수량
  const giftPrev = data.giftQty.previousYear as unknown as Record<string, number>;
  const giftCurr = data.giftQty.currentYear as unknown as Record<string, number>;
  addCategoryRows("증정수량", giftPrev, giftCurr, COLORS.rowEven, false);

  row += 2;

  // 주요품목 판매 현황
  ws.getCell(row, 1).value = `■ 주요품목 판매 현황 (조회기간: ${currPeriodShort})`;
  ws.getCell(row, 1).style = { font: { ...BASE_FONT, bold: true, color: { argb: COLORS.text } } };
  row += 2;

  const brands = data.topBrands ?? [];
  const brandHeaderRow = row;
  ws.getCell(row, 1).value = "교재명";
  ws.getCell(row, 1).style = { ...headerStyle, ...baseBorder };
  ws.mergeCells(brandHeaderRow, 1, brandHeaderRow, 2);
  ws.getCell(row, 3).value = prevYearLabel;
  ws.getCell(row, 3).style = { ...headerStyle, ...baseBorder };
  ws.getCell(row, 4).value = currYearLabel;
  ws.getCell(row, 4).style = { ...headerStyle, ...baseBorder };
  ws.getCell(row, 5).value = "증감";
  ws.getCell(row, 5).style = { ...headerStyle, ...baseBorder };
  row++;

  brands.forEach((r, idx) => {
    const evenBg = idx % 2 === 0 ? { fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: COLORS.rowEven } } } : {};
    ws.getCell(row, 1).value = r.brand;
    ws.getCell(row, 1).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "left" } };
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 3).value = formatAmount(r.qtyPrevious);
    ws.getCell(row, 3).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "center" } };
    ws.getCell(row, 4).value = formatAmount(r.qtyCurrent);
    ws.getCell(row, 4).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "center" } };
    const changeStyle =
      r.isIncrease === true
        ? { font: { ...BASE_FONT, color: { argb: COLORS.increase } } }
        : r.isIncrease === false
          ? { font: { ...BASE_FONT, color: { argb: COLORS.decrease } } }
          : {};
    ws.getCell(row, 5).value = `${r.changePercent !== "-" ? (r.isIncrease === true ? "▲" : r.isIncrease === false ? "▼" : "") : ""}${r.changePercent}`;
    ws.getCell(row, 5).style = { ...baseBorder, ...evenBg, alignment: { horizontal: "center" }, ...changeStyle };
    row++;
  });

  // 컬럼 너비: 1~2열 기본, 3~15열(금액) 12
  const COL_WIDTH = (100 - 5) / 7;
  for (let c = 1; c <= 15; c++) {
    ws.getColumn(c).width = c >= 3 ? 12 : COL_WIDTH;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
