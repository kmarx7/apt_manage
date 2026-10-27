/* 회차 규칙: 계산 입력 만들기, 새 회차, 확정·확정 취소. 모두 새 객체를 돌려주고 입력을 바꾸지 않는다. */
import { compute, type CalcConfig, type CalcResult } from './calc';
import type { AppData, Household, Period, Settings } from './schema';

export const byOrder = (a: Household, b: Household) => a.dong - b.dong || a.seq - b.seq;
export const sortHouseholds = (hh: Household[]): Household[] => [...hh].sort(byOrder);
export const sortPeriods = (ps: Period[]): Period[] => [...ps].sort((a, b) => a.id.localeCompare(b.id));

export const monthsLabel = (m1: number) => `${m1}·${m1 + 1}월`;
export const periodLabel = (p: Pick<Period, 'year' | 'm1'>) => `${p.year}년 ${monthsLabel(p.m1)}`;
export const periodId = (year: number, m1: number) => `${year}-${String(m1).padStart(2, '0')}`;
export const isLocked = (p: Period) => p.status !== 'draft';

export const nextOf = (p: Pick<Period, 'year' | 'm1'>) => {
  let year = p.year;
  let m1 = p.m1 + 2;
  if (m1 > 12) {
    m1 = 1;
    year += 1;
  }
  return { year, m1, id: periodId(year, m1), label: monthsLabel(m1) };
};

/** 2개월 회차의 첫 달(1,3,5,7,9,11)로 맞춘다. */
export const periodStartOf = (date: Date) => {
  const m = date.getMonth() + 1;
  return { year: date.getFullYear(), m1: m % 2 === 1 ? m : m - 1 };
};

export const prevPeriodOf = (data: AppData, p: Period): Period | null => {
  const ps = sortPeriods(data.periods);
  const i = ps.findIndex((x) => x.id === p.id);
  return i > 0 ? ps[i - 1] : null;
};

/** 회차에 실제로 들어 있는 세대를 검침 순서로. 공동전기 부과 여부는 확정 때 고정한 값을 우선한다. */
export const periodHouseholds = (p: Period, households: Household[]): Household[] =>
  sortHouseholds(households.filter((h) => h.id in p.readings)).map((h) =>
    p.elecOn && h.id in p.elecOn ? { ...h, elecOn: p.elecOn[h.id] } : h,
  );

export const cfgOf = (p: Period, settings: Settings): CalcConfig => ({
  tiers: p.tiers.filter((t) => t.min > 0),
  roundUnit: p.roundUnit ?? settings.roundUnit,
  elecFee: p.elecFee ?? settings.elecFee,
});

export const calcPeriod = (p: Period, data: Pick<AppData, 'settings' | 'households'>): CalcResult<Household> =>
  compute(periodHouseholds(p, data.households), p.readings, p, cfgOf(p, data.settings));

const freshPeriod = (year: number, m1: number, data: AppData, prevOfId: (id: string) => number): Period => {
  const active = sortHouseholds(data.households.filter((h) => h.active));
  return {
    id: periodId(year, m1),
    year,
    m1,
    status: 'draft',
    bill: 0,
    billQty: 0,
    method: data.settings.defaultMethod,
    adj: 0,
    adjNote: '',
    issued: null,
    tiers: data.settings.defaultTiers.map((t) => ({ ...t })),
    readings: Object.fromEntries(active.map((h) => [h.id, { prev: prevOfId(h.id), curr: '' as const }])),
    checked: {},
  };
};

/** 회차가 하나도 없을 때 첫 회차. 전월값은 0으로 두고 사용자가 채운다. */
export const createFirstPeriod = (data: AppData, year: number, m1: number): AppData => {
  if (data.periods.length > 0) throw new Error('이미 회차가 있습니다');
  return { ...data, periods: [freshPeriod(year, m1, data, () => 0)] };
};

/** 다음 회차를 만든다. 직전 회차의 당월값이 전월값이 되고, 확정 회차는 마감된다. */
export const createNextPeriod = (data: AppData): AppData => {
  const ps = sortPeriods(data.periods);
  const last = ps.at(-1);
  if (!last) throw new Error('회차가 없습니다');
  if (last.status === 'draft') throw new Error('마지막 회차를 먼저 확정하세요');
  const nx = nextOf(last);
  const prevOfId = (id: string) => {
    const r = last.readings[id];
    if (!r) return 0;
    return r.curr === '' ? r.prev : r.curr;
  };
  const closed = ps.map((p) => (p.status === 'done' ? { ...p, status: 'closed' as const } : p));
  return { ...data, periods: [...closed, freshPeriod(nx.year, nx.m1, data, prevOfId)] };
};

const replacePeriod = (data: AppData, next: Period): AppData => ({
  ...data,
  periods: data.periods.map((p) => (p.id === next.id ? next : p)),
});

/** 확정: 발행일과 금액 계산에 쓰는 설정을 고정한다. */
export const confirmPeriod = (data: AppData, id: string, issued: string, confirmedAt = new Date().toISOString()): AppData => {
  const p = data.periods.find((x) => x.id === id);
  if (!p) throw new Error('회차를 찾을 수 없습니다');
  if (p.status !== 'draft') throw new Error('작성 중인 회차만 확정할 수 있습니다');
  const r = calcPeriod(p, data);
  if (!r.ready) throw new Error('검침값과 고지서 금액을 모두 입력해야 확정할 수 있습니다');
  const neg = r.rows.filter((x) => x.u != null && x.u < 0).map((x) => x.id);
  if (neg.length) throw new Error(`당월값이 전월값보다 작은 세대가 있습니다: ${neg.join(', ')}`);
  const hh = periodHouseholds(p, data.households);
  return replacePeriod(data, {
    ...p,
    status: 'done',
    issued,
    confirmedAt,
    elecFee: data.settings.elecFee,
    roundUnit: data.settings.roundUnit,
    elecOn: Object.fromEntries(hh.map((h) => [h.id, h.elecOn])),
  });
};

/** 확정 취소: 마감 전(확정 상태)에만 가능. 고정했던 값을 풀어 현재 설정을 다시 따른다. */
export const unconfirmPeriod = (data: AppData, id: string): AppData => {
  const p = data.periods.find((x) => x.id === id);
  if (!p) throw new Error('회차를 찾을 수 없습니다');
  if (p.status !== 'done') throw new Error('확정 상태인 회차만 취소할 수 있습니다');
  const { elecFee: _e, roundUnit: _r, elecOn: _o, confirmedAt: _c, ...rest } = p;
  return replacePeriod(data, { ...rest, status: 'draft', issued: null });
};

/**
 * 백업에서 불러온 데이터를 앱 규칙에 맞춘다.
 * - 확정·마감 회차인데 고정값이 없으면 지금 설정으로 채운다.
 * - 기금 시작 회차가 없으면 첫 번째 작성 중/확정 회차로 정한다.
 */
export const normalizeData = (data: AppData): AppData => {
  const periods = sortPeriods(data.periods).map((p) => {
    if (p.status === 'draft') return p;
    const hh = periodHouseholds(p, data.households);
    return {
      ...p,
      elecFee: p.elecFee ?? data.settings.elecFee,
      roundUnit: p.roundUnit ?? data.settings.roundUnit,
      elecOn: p.elecOn ?? Object.fromEntries(hh.map((h) => [h.id, h.elecOn])),
    };
  });
  let startPeriod = data.fund.startPeriod;
  if (!startPeriod && periods.length > 0) {
    const open = periods.find((p) => p.status !== 'closed');
    startPeriod = open ? open.id : nextOf(periods.at(-1)!).id;
  }
  return { ...data, periods, fund: { ...data.fund, startPeriod } };
};
