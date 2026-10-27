import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { writeWorkbook } from '../src/lib/xlsx';
import { NF } from '../src/lib/xlsxData';
import { buildStatementSheet, RIGHT, TABLE_HEAD, TABLE_ROW, type GridSpec } from '../src/lib/xlsxStatement';
import { fakeData, fakePeriod } from './fake';

/** (행, 열) 칸 값. 없으면 undefined */
const at = (s: GridSpec, r: number, c: number) => s.cells.find((x) => x.r === r && x.c === c);
const rowVals = (s: GridSpec, r: number, c0: number) => TABLE_HEAD.map((_, j) => at(s, r, c0 + j)?.v);

// 가상 회차: A1 10㎥, A2 20㎥(공동전기 없음), B1 30㎥ / 고지서 120,000원·80㎥ → 적용 단가 1,750
describe('정산표 시트 내용', () => {
  const s = buildStatementSheet(fakeData(), '2030-03');

  it('제목과 상태', () => {
    expect(at(s, 1, 1)).toMatchObject({ v: '2030년 3월 · 4월 수도요금 정산표', span: 11, style: 'title' });
    expect(at(s, 1, RIGHT)?.v).toBe('상태: 작성 중   발행일: 확정 전');
  });

  it('요약: 머리칸 아래에 값', () => {
    expect(at(s, 3, 2)?.v).toBe('고지서 금액');
    expect(at(s, 4, 2)).toMatchObject({ v: 120000, fmt: NF.int });
    expect(at(s, 3, 6)?.v).toBe('누수율');
    expect(at(s, 4, 6)).toMatchObject({ v: 0.25, fmt: NF.pct });
    expect(at(s, 3, 11)?.v).toBe('적용 단가');
    expect(at(s, 4, 11)).toMatchObject({ v: 1750, fmt: NF.price });
    expect(at(s, 6, 7)?.v).toBe('수도 정산 차액');
    expect(at(s, 7, 7)).toMatchObject({ v: -11000, fmt: NF.neg });
    expect(at(s, 7, 8)?.v).toBe(181);
    expect(at(s, 6, 9)).toMatchObject({ v: '단가 방식', span: 3 });
  });

  it('1동은 왼쪽에 아래층부터(검침 순서 반대), 2동은 오른쪽', () => {
    expect(at(s, TABLE_ROW - 2, 1)?.v).toBe('1동');
    expect(at(s, TABLE_ROW - 2, RIGHT)?.v).toBe('2동');
    expect(rowVals(s, TABLE_ROW - 1, 1)).toEqual(TABLE_HEAD);
    expect(rowVals(s, TABLE_ROW, 1)).toEqual([1, 'A2', 200, 220, 20, 35000, 35000, 2000, 37000, 0, 37000]);
    expect(rowVals(s, TABLE_ROW + 1, 1)).toEqual([2, 'A1', 100, 110, 10, 17500, 17500, 0, 17500, 2500, 20000]);
    expect(rowVals(s, TABLE_ROW, RIGHT)).toEqual([1, 'B1', 300, 330, 30, 52500, 52500, 2000, 54500, 2500, 57000]);
  });

  it('동별 합계와 총계, 수도요금만의 차액', () => {
    expect(rowVals(s, TABLE_ROW + 2, 1)).toEqual(['합계', '2세대', null, null, 30, 52500, 52500, 2000, 54500, 2500, 57000]);
    expect(rowVals(s, TABLE_ROW + 1, RIGHT)).toEqual(['합계', '1세대', null, null, 30, 52500, 52500, 2000, 54500, 2500, 57000]);
    const t = TABLE_ROW + 4;
    expect(rowVals(s, t, 1)).toEqual(['총계', '3세대', null, null, 60, 105000, 105000, 4000, 109000, 5000, 114000]);
    expect(at(s, t + 2, 11)?.v).toBe(109000);
    expect(at(s, t + 3, 11)?.v).toBe(120000);
    expect(at(s, t + 4, 8)?.v).toBe('차액 (수도요금 − 고지서)');
    expect(at(s, t + 4, 11)).toMatchObject({ v: -11000, fmt: NF.neg });
  });

  it('검침이 덜 끝난 회차는 금액 칸을 비운다', () => {
    const d = fakeData({ periods: [fakePeriod({ readings: { A1: { prev: 100, curr: 110 }, A2: { prev: 200, curr: '' }, B1: { prev: 300, curr: 330 } } })] });
    const g = buildStatementSheet(d, '2030-03');
    expect(rowVals(g, TABLE_ROW, 1)).toEqual([1, 'A2', 200, null, null, null, null, null, null, 0, null]);
    expect(at(g, 4, 5)?.v).toBeNull(); // 누수량
    expect(at(g, 7, 4)?.v).toBeNull(); // 수도요금 합계
    expect(rowVals(g, TABLE_ROW + 2, 1).slice(4)).toEqual([10, null, null, null, null, null, null]);
  });

  it('없는 회차는 오류', () => {
    expect(() => buildStatementSheet(fakeData(), '1999-01')).toThrow('회차를 찾을 수 없습니다');
  });
});

describe('정산표 시트 파일', () => {
  it('합친 칸, 회색 머리칸, 숫자 서식, A4 가로 인쇄', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await writeWorkbook([buildStatementSheet(fakeData(), '2030-03')]));
    const ws = wb.getWorksheet('정산표')!;
    expect(ws.getCell('A1').value).toBe('2030년 3월 · 4월 수도요금 정산표');
    expect(ws.getCell('A1').isMerged).toBe(true);
    expect(ws.getCell('K1').isMerged).toBe(true);
    expect(ws.getCell('B3').fill).toMatchObject({ fgColor: { argb: 'FFD8D8D8' } });
    expect(ws.getCell('B4').numFmt).toBe('#,##0');
    expect(ws.getCell(`B${TABLE_ROW}`).value).toBe('A2');
    expect(ws.getCell(`K${TABLE_ROW}`).value).toBe(37000);
    expect(ws.getCell(`K${TABLE_ROW}`).border?.left?.style).toBe('thin');
    expect(ws.getCell(`M${TABLE_ROW}`).value).toBe(1);
    expect(ws.getCell(`N${TABLE_ROW}`).value).toBe('B1');
    expect(ws.pageSetup.orientation).toBe('landscape');
    expect(ws.pageSetup.fitToWidth).toBe(1);
  });
});
