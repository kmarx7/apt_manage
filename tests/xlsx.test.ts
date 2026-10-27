import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { confirmPeriod, createNextPeriod } from '../src/lib/period';
import type { AppData } from '../src/lib/schema';
import { writeWorkbook } from '../src/lib/xlsx';
import { buildWorkbookSpec, NF, xlsxFilename } from '../src/lib/xlsxData';
import { fakeData } from './fake';

/** 가상 2회차: 3·4월 확정 → 5·6월 작성 */
const twoPeriods = (): AppData => {
  const d = createNextPeriod(confirmPeriod(fakeData(), '2030-03', '2030-04-30'));
  return {
    ...d,
    periods: d.periods.map((p) =>
      p.id === '2030-05'
        ? { ...p, bill: 130000, billQty: 90, readings: { A1: { prev: 110, curr: 125 }, A2: { prev: 220, curr: 238 }, B1: { prev: 330, curr: 352 } } }
        : p,
    ),
  };
};

const find = (rows: { cells: unknown[] }[], key: string) => rows.find((r) => r.cells[0] === key);

describe('엑셀 내용', () => {
  it('파일 이름', () => {
    expect(xlsxFilename({ year: 2030, m1: 5 })).toBe('수도요금_정산_2030_05-06.xlsx');
  });

  it('시트 3개: 정산 요약, 세대별, 기금 장부', () => {
    expect(buildWorkbookSpec(twoPeriods(), '2030-05').map((s) => s.name)).toEqual(['정산 요약', '세대별', '기금 장부']);
  });

  it('정산 요약: 금액은 #,##0, 단가는 #,##0.00, 누수율은 0.0%', () => {
    const [s] = buildWorkbookSpec(fakeData(), '2030-03');
    expect(find(s.rows, '상태')?.cells[1]).toBe('작성 중');
    expect(find(s.rows, '발행일')?.cells[1]).toBe('확정 전');
    expect(find(s.rows, '고지서 총액(원)')).toMatchObject({ cells: ['고지서 총액(원)', 120000], fmts: [null, NF.int] });
    expect(find(s.rows, '누수율')).toMatchObject({ cells: ['누수율', 0.25], fmts: [null, NF.pct] });
    expect(find(s.rows, '적용 단가(원/㎥)')).toMatchObject({ cells: [expect.any(String), 1750], fmts: [null, NF.price] });
    expect(find(s.rows, '수도 정산 차액(원)')?.cells[1]).toBe(-11000);
    expect(find(s.rows, '손익 0 조정값(원/㎥)')?.cells[1]).toBe(181);
    // 누진 구간은 낮은 기준부터
    expect(s.rows.slice(-3).map((r) => r.cells)).toEqual([['20㎥ 이상', 2000], ['40㎥ 이상', 4000], ['50㎥ 이상', 5000]]);
  });

  it('세대별: 15열, 지난 회차 비교, 합계 행', () => {
    const [, h] = buildWorkbookSpec(twoPeriods(), '2030-05');
    expect(h.header).toHaveLength(15);
    // A1: 사용량 15, 지난 10 → +5
    expect(h.rows[0].cells.slice(0, 8)).toEqual([1, '1동', 'A1', 110, 125, 15, 10, 5]);
    const total = h.rows.at(-1)!;
    expect(total.bold).toBe(true);
    expect(total.cells[2]).toBe('합계');
    expect(total.cells[5]).toBe(55); // 15 + 18 + 22
    expect(total.cells[6]).toBe(60); // 지난 회차 10 + 20 + 30
    expect(total.cells[7]).toBe(-5);
    const sumTotal = h.rows.slice(0, -1).reduce((a, r) => a + (r.cells[12] as number), 0);
    expect(total.cells[12]).toBe(sumTotal);
  });

  it('기금 장부: 확정·예정 구분과 잔액', () => {
    const [, , f] = buildWorkbookSpec(twoPeriods(), '2030-05');
    expect(f.header).toEqual(['날짜', '구분', '내용', '금액(원)', '잔액(원)', '비고']);
    const diff = f.rows.find((r) => r.cells[1] === '수도 정산 차액' && r.cells[0] === '2030. 4. 30.');
    expect(diff?.cells[5]).toBe('');
    expect(f.rows.some((r) => r.cells[5] === '예정')).toBe(true);
    expect(f.rows.at(-2)?.cells[1]).toBe('확정분 잔액');
    expect(f.rows.at(-1)?.cells[1]).toBe('예정 포함 잔액');
  });
});

describe('엑셀 파일 (실제로 쓰고 다시 읽기)', () => {
  it('서식과 값이 파일에 그대로 들어간다', async () => {
    const buf = await writeWorkbook(buildWorkbookSpec(twoPeriods(), '2030-05'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['정산 요약', '세대별', '기금 장부']);

    const s = wb.getWorksheet('정산 요약')!;
    const rowOf = (k: string) => s.getRows(1, s.rowCount)!.find((r) => r.getCell(1).value === k)!;
    expect(rowOf('고지서 총액(원)').getCell(2).numFmt).toBe('#,##0');
    expect(rowOf('적용 단가(원/㎥)').getCell(2).numFmt).toBe('#,##0.00');
    expect(rowOf('누수율').getCell(2).numFmt).toBe('0.0%');

    const h = wb.getWorksheet('세대별')!;
    expect(h.getRow(3).getCell(1).value).toBe('순서');
    expect(h.getRow(4).getCell(3).value).toBe('A1');
    expect(h.getRow(4).getCell(4).numFmt).toBe('#,##0');
    expect(h.getRow(4).getCell(13).numFmt).toBe('#,##0');
    expect(h.getRow(4).getCell(3).numFmt).toBeFalsy();
    expect(h.getRow(4).getCell(1).alignment?.horizontal).toBe('center');
    expect(h.lastRow!.getCell(3).value).toBe('합계');

    const f = wb.getWorksheet('기금 장부')!;
    expect(f.getRow(4).getCell(4).numFmt).toBe('#,##0');
  });
});
