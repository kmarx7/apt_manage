import { describe, expect, it } from 'vitest';
import { emptyData } from '../src/lib/defaults';
import {
  calcPeriod, confirmPeriod, createFirstPeriod, createNextPeriod, nextOf, normalizeData,
  periodHouseholds, periodLabel, periodStartOf, unconfirmPeriod,
} from '../src/lib/period';
import { fakeData, fakePeriod } from './fake';

describe('회차 이름과 순서', () => {
  it('2개월 단위로 넘어가고 11·12월 다음은 이듬해 1·2월', () => {
    expect(nextOf({ year: 2030, m1: 7 })).toMatchObject({ year: 2030, m1: 9, id: '2030-09', label: '9·10월' });
    expect(nextOf({ year: 2030, m1: 11 })).toMatchObject({ year: 2031, m1: 1, id: '2031-01' });
    expect(periodLabel({ year: 2030, m1: 3 })).toBe('2030년 3·4월');
  });
  it('오늘 날짜로 회차 첫 달을 정한다', () => {
    expect(periodStartOf(new Date(2030, 7, 15))).toEqual({ year: 2030, m1: 7 });
    expect(periodStartOf(new Date(2030, 0, 1))).toEqual({ year: 2030, m1: 1 });
  });
});

describe('새 회차', () => {
  it('작성 중인 회차가 있으면 만들지 않는다', () => {
    expect(() => createNextPeriod(fakeData())).toThrow('확정');
  });
  it('직전 당월값이 전월값이 되고, 확정 회차는 마감된다', () => {
    const d = confirmPeriod(fakeData(), '2030-03', '2030-04-30');
    const n = createNextPeriod(d);
    expect(n.periods.map((p) => [p.id, p.status])).toEqual([['2030-03', 'closed'], ['2030-05', 'draft']]);
    const p = n.periods[1];
    expect(p.readings).toEqual({ A1: { prev: 110, curr: '' }, A2: { prev: 220, curr: '' }, B1: { prev: 330, curr: '' } });
    expect(p.bill).toBe(0);
    expect(p.issued).toBeNull();
    expect(d.periods[0].status).toBe('done'); // 입력은 바뀌지 않는다
  });
  it('비활성 세대는 빼고, 새로 추가한 세대는 전월 0', () => {
    const base = confirmPeriod(fakeData(), '2030-03', '2030-04-30');
    const d = {
      ...base,
      households: [
        ...base.households.map((h) => (h.id === 'A2' ? { ...h, active: false } : h)),
        { id: 'C1', dong: 2 as const, seq: 2, elecOn: true, active: true },
      ],
    };
    const p = createNextPeriod(d).periods[1];
    expect(Object.keys(p.readings)).toEqual(['A1', 'B1', 'C1']);
    expect(p.readings.C1.prev).toBe(0);
  });
  it('첫 회차는 기본 세대와 설정값으로 만든다', () => {
    const d = createFirstPeriod(emptyData(), 2030, 9);
    expect(d.periods).toHaveLength(1);
    expect(Object.keys(d.periods[0].readings)).toHaveLength(26);
    expect(d.periods[0].method).toBe('avg');
    expect(() => createFirstPeriod(d, 2030, 11)).toThrow();
  });
});

describe('확정과 확정 취소', () => {
  it('입력이 다 안 됐으면 확정할 수 없다', () => {
    const d = fakeData({ periods: [fakePeriod({ readings: { ...fakePeriod().readings, B1: { prev: 300, curr: '' } } })] });
    expect(() => confirmPeriod(d, '2030-03', '2030-04-30')).toThrow('모두 입력');
  });
  it('사용량이 음수인 세대가 있으면 확정할 수 없다', () => {
    const d = fakeData({ periods: [fakePeriod({ readings: { ...fakePeriod().readings, A2: { prev: 200, curr: 190 } } })] });
    expect(() => confirmPeriod(d, '2030-03', '2030-04-30')).toThrow('A2');
  });
  it('확정하면 발행일과 설정값이 고정되어 이후 설정을 바꿔도 금액이 그대로다', () => {
    const d = confirmPeriod(fakeData(), '2030-03', '2030-04-30');
    const before = calcPeriod(d.periods[0], d);
    const changed = {
      ...d,
      settings: { ...d.settings, elecFee: 9999, roundUnit: 1000 },
      households: d.households.map((h) => ({ ...h, elecOn: !h.elecOn })),
    };
    const after = calcPeriod(changed.periods[0], changed);
    expect(d.periods[0].issued).toBe('2030-04-30');
    expect(after.rows.map((r) => r.total)).toEqual(before.rows.map((r) => r.total));
    expect(after.waterTotal).toBe(before.waterTotal);
  });
  it('확정 취소하면 작성 중으로 돌아가고 고정값이 풀린다', () => {
    const d = unconfirmPeriod(confirmPeriod(fakeData(), '2030-03', '2030-04-30'), '2030-03');
    expect(d.periods[0]).toMatchObject({ status: 'draft', issued: null });
    expect(d.periods[0].elecFee).toBeUndefined();
    expect(d.periods[0].elecOn).toBeUndefined();
  });
  it('마감 회차는 확정 취소할 수 없다', () => {
    const d = createNextPeriod(confirmPeriod(fakeData(), '2030-03', '2030-04-30'));
    expect(() => unconfirmPeriod(d, '2030-03')).toThrow();
  });
});

describe('세대 구성', () => {
  it('회차에 들어 있는 세대만 동·순서대로', () => {
    const p = fakePeriod({ readings: { B1: { prev: 0, curr: 1 }, A1: { prev: 0, curr: 1 } } });
    expect(periodHouseholds(p, fakeData().households).map((h) => h.id)).toEqual(['A1', 'B1']);
  });
});

describe('불러온 데이터 정리', () => {
  it('확정·마감 회차에 고정값을 채우고 기금 시작 회차를 정한다', () => {
    const d = fakeData({
      periods: [fakePeriod({ id: '2030-01', m1: 1, status: 'closed' }), fakePeriod()],
      fund: { start: null, unit3: {}, expenses: [] },
    });
    const n = normalizeData(d);
    expect(n.periods[0]).toMatchObject({ elecFee: 2500, roundUnit: 100, elecOn: { A1: true, A2: false, B1: true } });
    expect(n.periods[1].elecFee).toBeUndefined();
    expect(n.fund.startPeriod).toBe('2030-03');
  });
});
