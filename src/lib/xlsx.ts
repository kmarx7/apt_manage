/* 엑셀 파일 쓰기. exceljs는 저장할 때만 불러온다. */
import type { SheetSpec } from './xlsxData';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function writeWorkbook(sheets: SheetSpec[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = '예그린 수도정산';

  for (const s of sheets) {
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

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
