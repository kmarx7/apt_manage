/* 수도요금 정산 엔진 — reference/calc.js를 그대로 옮김. 엑셀 결과와 1원 단위 일치가 기준이다. */

export type Method = 'avg' | 'full' | 'fullMinusN';
export type Tier = { min: number; fee: number };
export type CalcConfig = { tiers: Tier[]; roundUnit: number; elecFee: number };
export type CalcHousehold = { id: string; elecOn: boolean };
export type Reading = { prev: number; curr: number | '' | null };
export type CalcPeriod = { bill: number; billQty: number; method: Method; adj: number };

export type Row<H extends CalcHousehold = CalcHousehold> = H & {
  prev: number | undefined;
  curr: number | null;
  u: number | null;
  use: number | null;
  sur: number | null;
  water: number | null;
  elec: number;
  total: number | null;
};

export type CalcResult<H extends CalcHousehold = CalcHousehold> = {
  rows: Row<H>[];
  ready: boolean;
  metered: number;
  N: number;
  filledCount: number;
  leak: number;
  leakRate: number | null;
  unitBill: number | null;
  unitMeter: number | null;
  base: number | null;
  P: number | null;
  breakEven: number | null;
  useTotal: number;
  surTotal: number;
  waterTotal: number;
  elecTotal: number;
  diff: number | null;
};

export const DEFAULT_TIERS: Tier[] = [
  { min: 50, fee: 5000 },
  { min: 40, fee: 4000 },
  { min: 20, fee: 2000 },
];

export const DEFAULT_CFG: CalcConfig = { tiers: DEFAULT_TIERS, roundUnit: 100, elecFee: 2500 };

export const BREAK_EVEN_MIN = -1000;
export const BREAK_EVEN_MAX = 3000;

/** 기준 이상인 구간 중 가장 높은 구간 금액 하나만. 구간은 순서와 상관없이 입력될 수 있어 높은 기준부터 본다. */
export const sortTiers = (tiers: Tier[]): Tier[] => [...tiers].sort((a, b) => b.min - a.min);

export const surcharge = (u: number, tiers: Tier[]): number => {
  for (const t of tiers) if (u >= t.min) return t.fee;
  return 0;
};

/** 엑셀 ROUNDUP(x,-2): 부동소수 오차(593.0000001 등)를 먼저 정리한 뒤 올림 */
export const ceilTo = (x: number, unit: number): number =>
  Math.ceil(Math.round((x / unit) * 1e6) / 1e6) * unit;

export const baseUnit = (method: Method, bill: number, billQty: number, metered: number, N: number): number => {
  const dQ = bill / billQty;
  const dM = bill / metered;
  if (method === 'full') return dM;
  if (method === 'fullMinusN') return (bill - N) / metered;
  return (dQ + dM) / 2; // 'avg' = 현행
};

const isFilled = (curr: unknown): boolean =>
  curr !== '' && curr != null && !Number.isNaN(Number(curr));

export function compute<H extends CalcHousehold>(
  households: H[],
  readings: Record<string, Reading | undefined>,
  period: CalcPeriod,
  cfg: CalcConfig = DEFAULT_CFG,
): CalcResult<H> {
  const tiers = sortTiers(cfg.tiers);
  const base0 = households.map((h) => {
    const r = readings[h.id];
    const prev = r?.prev;
    const filled = isFilled(r?.curr);
    const u = filled ? Number(r!.curr) - Number(prev) : null;
    return { h, prev, curr: filled ? Number(r!.curr) : null, u };
  });
  const done = base0.filter((r): r is typeof r & { u: number } => r.u != null);
  const metered = done.reduce((s, r) => s + Math.max(r.u, 0), 0);
  const N = done.reduce((s, r) => s + surcharge(r.u, tiers), 0);
  const { bill, billQty, method, adj } = period;
  const ready = done.length === base0.length && bill > 0 && billQty > 0 && metered > 0;

  const priceAt = (p: number): number => {
    let water = 0;
    for (const r of done) water += ceilTo(r.u * p, cfg.roundUnit) + surcharge(r.u, tiers);
    return water;
  };

  let base: number | null = null;
  let P: number | null = null;
  let breakEven: number | null = null;
  if (ready) {
    base = baseUnit(method, bill, billQty, metered, N);
    P = base + (Number(adj) || 0);
    for (let a = BREAK_EVEN_MIN; a <= BREAK_EVEN_MAX; a++) {
      if (priceAt(base + a) >= bill) {
        breakEven = a;
        break;
      }
    }
  }

  let waterTotal = 0;
  let elecTotal = 0;
  let surTotal = 0;
  let useTotal = 0;
  const rows: Row<H>[] = base0.map(({ h, prev, curr, u }) => {
    const elec = h.elecOn ? cfg.elecFee : 0;
    if (u == null || P == null) {
      return { ...h, prev, curr, u, use: null, sur: null, water: null, elec, total: null };
    }
    const use = ceilTo(u * P, cfg.roundUnit);
    const sur = surcharge(u, tiers);
    const water = use + sur;
    useTotal += use;
    surTotal += sur;
    waterTotal += water;
    elecTotal += elec;
    return { ...h, prev, curr, u, use, sur, water, elec, total: water + elec };
  });

  return {
    rows,
    ready,
    metered,
    N,
    filledCount: done.length,
    leak: billQty - metered,
    leakRate: billQty > 0 ? (billQty - metered) / billQty : null,
    unitBill: billQty > 0 ? bill / billQty : null,
    unitMeter: metered > 0 ? bill / metered : null,
    base,
    P,
    breakEven,
    useTotal,
    surTotal,
    waterTotal,
    elecTotal,
    diff: ready ? waterTotal - bill : null,
  };
}
