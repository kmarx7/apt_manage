/*
 * 로컬 전용: 실제 백업으로 엑셀을 만들어 다시 읽고, 세대별 수도요금이 원본 엑셀(픽스처)과 같은지 본다.
 * 기대값은 모두 맥의 local-data 파일에서 읽는다.
 */
import ExcelJS from 'exceljs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '../src/lib/backup';
import { writeWorkbook } from '../src/lib/xlsx';
import { buildWorkbookSpec } from '../src/lib/xlsxData';

const root = resolve(__dirname, '..');
const find = (name: string) => [`local-data/${name}`, `_handoff/local-data/${name}`].map((p) => resolve(root, p)).find(existsSync);
const seedPath = find('seed-backup.json');
const fxPath = find('excel-fixtures.json');

describe.skipIf(!seedPath || !fxPath)('실제 데이터 엑셀 저장 (로컬 전용)', () => {
  it('세대별 시트의 수도요금과 합계가 원본 엑셀과 같다', async () => {
    const r = parseBackup(readFileSync(seedPath!, 'utf8'));
    if (!r.ok) throw new Error(r.error);
    const fixtures = JSON.parse(readFileSync(fxPath!, 'utf8'));
    let checked = 0;
    for (const p of r.data.periods) {
      const fx = fixtures[`${p.m1}${p.m1 + 1}`];
      if (!fx) continue;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await writeWorkbook(buildWorkbookSpec(r.data, p.id)));
      const ws = wb.getWorksheet('세대별')!;
      const got: Record<string, number> = {};
      ws.eachRow((row, n) => {
        const id = row.getCell(3).value;
        if (n > 3 && typeof id === 'string' && id !== '합계') got[id] = row.getCell(11).value as number;
      });
      const exp = Object.fromEntries(Object.entries(fx.exp as Record<string, number>).filter(([id]) => id in p.readings));
      expect(got).toEqual(exp);
      expect(ws.lastRow!.getCell(11).value).toBe(fx.I30);
      checked++;
    }
    expect(checked).toBe(2);
  });
});
