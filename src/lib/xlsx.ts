/* 엑셀 파일 쓰기. exceljs는 저장할 때만 불러온다. */
import type { Workbook, Worksheet, Cell as XCell } from 'exceljs';
import type { AnySheet, SheetSpec } from './xlsxData';
import type { GridSpec, GridStyle } from './xlsxStatement';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FONT = '나눔고딕';
const GRAY = 'FFD8D8D8';
const LIGHT = 'FFF2F2F2';
const thin = { style: 'thin' as const, color: { argb: 'FF808080' } };

function writeTable(wb: Workbook, s: SheetSpec): void {
  const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: s.header ? 3 : 2 }] });
  ws.columns = s.widths.map((width) => ({ width }));

  const title = ws.addRow([s.title]);
  title.font = { bold: true, size: 13 };
  ws.addRow([]);

  if (s.header) {
    const h = ws.addRow(s.header);
    h.font = { bold: true };
    h.alignment = { horizontal: 'center' };
    h.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6EDF0' } };
      c.border = { bottom: { style: 'thin', color: { argb: 'FF9AA7AD' } } };
    });
  }

  for (const r of s.rows) {
    const row = ws.addRow(r.cells.map((v) => (v === null ? null : v)));
    if (r.bold) row.font = { bold: true };
    for (const i of s.center ?? []) row.getCell(i + 1).alignment = { horizontal: 'center' };
    r.fmts?.forEach((fmt, i) => {
      if (fmt && typeof r.cells[i] === 'number') row.getCell(i + 1).numFmt = fmt;
    });
  }
}

/** 손으로 쓰던 정산 엑셀처럼: 나눔고딕, 회색 머리칸, 모든 칸 테두리와 가운데 정렬 */
function styleCell(c: XCell, style: GridStyle): void {
  if (style === 'title') {
    c.font = { name: FONT, size: 14, bold: true };
    c.alignment = { horizontal: 'left', vertical: 'middle' };
    return;
  }
  if (style === 'note') {
    c.font = { name: FONT, size: 11 };
    c.alignment = { horizontal: 'right', vertical: 'middle' };
    return;
  }
  c.font = { name: FONT, size: 11, bold: style !== 'cell' };
  c.alignment = style === 'head' ? { horizontal: 'center', vertical: 'middle', wrapText: true } : { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
  c.border = { top: thin, left: thin, bottom: thin, right: thin };
  if (style === 'head') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
  if (style === 'id') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
}

function writeGrid(wb: Workbook, s: GridSpec): void {
  const ws: Worksheet = wb.addWorksheet(s.name, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
  });
  ws.columns = s.widths.map((width) => ({ width }));

  for (const g of s.cells) {
    const span = g.span ?? 1;
    // 합친 칸도 칸마다 테두리를 그려야 선이 끊기지 않는다
    for (let k = 0; k < span; k++) styleCell(ws.getCell(g.r, g.c + k), g.style);
    const c = ws.getCell(g.r, g.c);
    c.value = g.v;
    if (g.fmt) c.numFmt = g.fmt;
    if (span > 1) ws.mergeCells(g.r, g.c, g.r, g.c + span - 1);
  }
  ws.eachRow((row, n) => {
    row.height = s.tall.includes(n) ? 34 : 20;
  });
}

export async function writeWorkbook(sheets: AnySheet[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = '예그린 수도정산';

  for (const s of sheets) {
    if ('kind' in s) writeGrid(wb, s);
    else writeTable(wb, s);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
