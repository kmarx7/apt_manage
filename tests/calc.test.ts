/* 계산 규칙 검증 — 모두 임의로 만든 가상 데이터다. 실제 검침값·금액을 넣지 않는다. */
import { describe, expect, it } from 'vitest';
import { ceilTo, compute, DEFAULT_CFG, surcharge, sortTiers, type CalcPeriod, type Reading } from '../src/lib/calc';

const hh = [
  { id: 'A', elecOn: true },
  { id: 'B', elecOn: true },
  { id: 'C', elecOn: false },
];
// 사용량 A=10, B=20, C=30 → 계량 합계 60㎥
const rd: Record<string, Reading> = {
  A: { prev: 100, curr: 110 },
  B: { prev: 200, curr: 220 },
  C: { prev: 300, curr: 330 },
};
// 고지서 120,000원 / 80㎥ → B/Q=1,500, B/M=2,000
const period = (p: Partial<CalcPeriod> = {}): CalcPeriod => ({ bill: 120000, billQty: 80, method: 'avg', adj: 0, ...p });
const waters = (r: ReturnType<typeof compute>) => r.rows.map((x) => x.water);

describe('ceilTo (엑셀 ROUNDUP(x,-2))', () => {
  it('100원 단위로 올린다', () => {
    expect(ceilTo(1201, 100)).toBe(1300);
    expect(ceilTo(1200.01, 100)).toBe(1300);
    expect(ceilTo(1299, 100)).toBe(1300);
  });
  it('딱 떨어지면 그대로 둔다', () => {
    expect(ceilTo(1200, 100)).toBe(1200);
    expect(ceilTo(0, 100)).toBe(0);
  });
  it('부동소수 오차는 정리한 뒤 올린다', () => {
    expect(ceilTo(59300.0000001, 100)).toBe(59300);
    expect(ceilTo(30 * (116000 / 60), 100)).toBe(58000);
    expect(ceilTo(0.1 * 3 * 1000, 100)).toBe(300);
  });
});

describe('누진 부과금', () => {
  const tiers = DEFAULT_CFG.tiers;
  it.each([
    [0, 0], [19, 0], [19.9, 0], [20, 2000], [39, 2000],
    [40, 4000], [49, 4000], [50, 5000], [120, 5000],
  ])('%s㎥ → %s원', (u, fee) => {
    expect(surcharge(u, tiers)).toBe(fee);
  });
  it('구간 순서가 섞여 들어와도 가장 높은 구간 하나만 붙는다', () => {
    const shuffled = [{ min: 20, fee: 2000 }, { min: 50, fee: 5000 }, { min: 40, fee: 4000 }];
    const r = compute(hh, { A: { prev: 0, curr: 55 } }, period(), { ...DEFAULT_CFG, tiers: shuffled });
    expect(surcharge(55, sortTiers(shuffled))).toBe(5000);
    expect(r.N).toBe(5000);
  });
  it('구간이 없으면 부과금이 없다', () => {
    expect(surcharge(99, [])).toBe(0);
  });
});

describe('기준 단가 방식', () => {
  it('avg (현행): (B/Q + B/M) / 2', () => {
    const r = compute(hh, rd, period({ method: 'avg' }));
    expect(r.metered).toBe(60);
    expect(r.N).toBe(4000);
    expect(r.base).toBe(1750);
    // A 17,500 / B 35,000+2,000 / C 52,500+2,000
    expect(waters(r)).toEqual([17500, 37000, 54500]);
    expect(r.waterTotal).toBe(109000);
    expect(r.diff).toBe(-11000);
  });
  it('full: B/M', () => {
    const r = compute(hh, rd, period({ method: 'full' }));
    expect(r.base).toBe(2000);
    expect(waters(r)).toEqual([20000, 42000, 62000]);
    expect(r.diff).toBe(4000);
  });
  it('fullMinusN: (B − N)/M', () => {
    const r = compute(hh, rd, period({ method: 'fullMinusN' }));
    expect(r.base).toBeCloseTo(1933.3333, 3);
    expect(waters(r)).toEqual([19400, 40700, 60000]);
    expect(r.waterTotal).toBe(120100);
  });
});

describe('추가조정', () => {
  it('적용 단가 = 기준 단가 + 조정', () => {
    const r = compute(hh, rd, period({ adj: 10 }));
    expect(r.P).toBe(1760);
    expect(waters(r)).toEqual([17600, 37200, 54800]);
  });
  it('음수 조정도 반영한다', () => {
    const r = compute(hh, rd, period({ adj: -50 }));
    expect(r.P).toBe(1700);
    expect(waters(r)).toEqual([17000, 36000, 53000]);
  });
});

describe('손익 0 조정값', () => {
  it('수도요금 합계가 고지서 총액 이상이 되는 가장 작은 조정값', () => {
    const r = compute(hh, rd, period());
    expect(r.breakEven).toBe(181);
    const at = compute(hh, rd, period({ adj: 181 }));
    const below = compute(hh, rd, period({ adj: 180 }));
    expect(at.waterTotal).toBeGreaterThanOrEqual(120000);
    expect(below.waterTotal).toBeLessThan(120000);
  });
  it('범위(−1000~3000) 안에 없으면 null', () => {
    const r = compute(hh, rd, period({ bill: 99_000_000, billQty: 80 }));
    expect(r.breakEven).toBeNull();
  });
});

describe('공동전기와 합계', () => {
  it('부과 세대만 2,500원, 고지액 = 수도요금 + 공동전기', () => {
    const r = compute(hh, rd, period());
    expect(r.rows.map((x) => x.elec)).toEqual([2500, 2500, 0]);
    expect(r.rows.map((x) => x.total)).toEqual([20000, 39500, 54500]);
    expect(r.elecTotal).toBe(5000);
  });
  it('누수량과 누수율', () => {
    const r = compute(hh, rd, period());
    expect(r.leak).toBe(20);
    expect(r.leakRate).toBe(0.25);
    expect(r.unitBill).toBe(1500);
    expect(r.unitMeter).toBe(2000);
  });
});

describe('입력이 덜 됐거나 이상한 경우', () => {
  it('당월값이 비어 있으면 계산하지 않는다', () => {
    const r = compute(hh, { ...rd, C: { prev: 300, curr: '' } }, period());
    expect(r.ready).toBe(false);
    expect(r.filledCount).toBe(2);
    expect(r.P).toBeNull();
    expect(r.diff).toBeNull();
    expect(r.rows[2].u).toBeNull();
    expect(r.rows[0].water).toBeNull();
    expect(r.rows[0].elec).toBe(2500);
  });
  it('검침 기록이 아예 없는 세대도 미입력으로 본다', () => {
    const r = compute(hh, { A: rd.A }, period());
    expect(r.filledCount).toBe(1);
    expect(r.ready).toBe(false);
  });
  it('음수 사용량은 계량 합계에서 0으로 본다', () => {
    const r = compute(hh, { ...rd, A: { prev: 100, curr: 95 } }, period());
    expect(r.rows[0].u).toBe(-5);
    expect(r.metered).toBe(50);
    expect(r.rows[0].sur).toBe(0);
  });
  it('고지서 총액이나 사용량이 0이면 계산하지 않는다', () => {
    expect(compute(hh, rd, period({ bill: 0 })).ready).toBe(false);
    expect(compute(hh, rd, period({ billQty: 0 })).leakRate).toBeNull();
  });
});
