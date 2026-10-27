/*
 * 로컬 전용: 실제 백업 파일을 앱의 "백업 불러오기" 경로(parseBackup → IndexedDB)로 넣고,
 * 회차 금액이 엑셀 픽스처와 같은지 확인한다. 실제 수치는 모두 맥의 local-data 파일에서 읽는다.
 */
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Repo, WaterDB } from '../src/db/db';
import { makeBackup, parseBackup } from '../src/lib/backup';
import { calcPeriod } from '../src/lib/period';

const root = resolve(__dirname, '..');
const find = (name: string) =>
  [`local-data/${name}`, `_handoff/local-data/${name}`].map((p) => resolve(root, p)).find(existsSync);
const seedPath = find('seed-backup.json');
const fxPath = find('excel-fixtures.json');

// 픽스처 키('56', '78')와 회차 첫 달의 대응
const fixtureKey = (m1: number) => `${m1}${m1 + 1}`;

describe.skipIf(!seedPath || !fxPath)('실제 백업 불러오기 (로컬 전용)', () => {
  const text = seedPath ? readFileSync(seedPath, 'utf8') : '';
  const fixtures = fxPath ? JSON.parse(readFileSync(fxPath, 'utf8')) : {};

  it('스키마 검증을 통과하고 미리보기가 나온다', () => {
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    expect(r.preview.householdCount).toBe(26);
    expect(r.preview.periodCount).toBeGreaterThanOrEqual(2);
  });

  it('IndexedDB에 넣었다 꺼낸 뒤에도 회차 금액이 엑셀과 같다', async () => {
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    const d = new WaterDB('seed-local');
    try {
      const repo = new Repo(d);
      await repo.replaceAll(r.data);
      const data = (await repo.load())!;
      let checked = 0;
      for (const p of data.periods) {
        const fx = fixtures[fixtureKey(p.m1)];
        if (!fx) continue;
        const res = calcPeriod(p, data);
        expect(res.ready).toBe(true);
        // 엑셀 픽스처의 지4호(폐지, 사용량 0)는 앱에 없다
        const exp = Object.fromEntries(Object.entries(fx.exp).filter(([id]) => id in p.readings));
        expect(Object.fromEntries(res.rows.map((x) => [x.id, x.water]))).toEqual(exp);
        expect(res.waterTotal).toBe(fx.I30);
        checked++;
      }
      expect(checked).toBe(2);
    } finally {
      await d.delete();
    }
  });

  it('다시 백업으로 내보내도 같은 데이터', () => {
    const r = parseBackup(text);
    if (!r.ok) throw new Error(r.error);
    const again = parseBackup(JSON.stringify(makeBackup(r.data, new Date())));
    if (!again.ok) throw new Error(again.error);
    // 마지막 백업 시각만 새 내보내기 시각으로 바뀐다
    const strip = (d: typeof r.data) => ({ ...d, settings: { ...d.settings, lastBackupAt: undefined } });
    expect(strip(again.data)).toEqual(strip(r.data));
  });
});
