/*
 * 로컬 전용: 엑셀 결과와 1원 단위 일치 검증.
 * 실제 데이터는 이 맥의 local-data/excel-fixtures.json에만 있다. 기대값도 그 파일에서 읽고, 여기에 숫자를 적지 않는다.
 * 파일이 없으면(CI, 다른 기기) 전체를 건너뛴다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compute, type CalcPeriod, type Reading } from '../src/lib/calc';

type Fixture = {
  hh: { id: string; elecOn: boolean }[];
  rd: Record<string, Reading>;
  exp: Record<string, number>;
  period: CalcPeriod;
  I30: number; // 엑셀의 세대 수도요금 합계 셀
};

const root = resolve(__dirname, '..');
const path = ['local-data/excel-fixtures.json', '_handoff/local-data/excel-fixtures.json']
  .map((p) => resolve(root, p))
  .find(existsSync);
const fixtures: Record<string, Fixture> = path ? JSON.parse(readFileSync(path, 'utf8')) : {};

describe.skipIf(!path)('엑셀 일치 (로컬 전용)', () => {
  for (const [name, fx] of Object.entries(fixtures)) {
    describe(`회차 ${name}`, () => {
      const r = compute(fx.hh, fx.rd, fx.period);

      it('모든 세대 입력이 끝나 계산된다', () => {
        expect(r.ready).toBe(true);
        expect(r.rows).toHaveLength(fx.hh.length);
      });

      it('세대별 수도요금이 엑셀과 1원 단위까지 같다', () => {
        const got = Object.fromEntries(r.rows.map((x) => [x.id, x.water]));
        expect(got).toEqual(fx.exp);
      });

      it('회차 합계가 엑셀과 같다', () => {
        expect(r.waterTotal).toBe(fx.I30);
      });

      it('손익 0 조정값이 정의대로 나온다', () => {
        expect(r.breakEven).not.toBeNull();
        const at = compute(fx.hh, fx.rd, { ...fx.period, adj: r.breakEven! });
        const below = compute(fx.hh, fx.rd, { ...fx.period, adj: r.breakEven! - 1 });
        expect(at.waterTotal).toBeGreaterThanOrEqual(fx.period.bill);
        expect(below.waterTotal).toBeLessThan(fx.period.bill);
      });
    });
  }
});
