/* 대시보드 한 화면에 필요한 계산을 한 번에 만든다. */
import { useMemo } from 'react';
import type { CalcResult } from '../../lib/calc';
import { judgeReading, type Judge } from '../../lib/judge';
import { buildLedger, type Ledger } from '../../lib/ledger';
import { sortTiers } from '../../lib/calc';
import { calcPeriod, cfgOf, prevPeriodOf } from '../../lib/period';
import type { AppData, Household, Period } from '../../lib/schema';

export type DashRow = CalcResult<Household>['rows'][number] & {
  idx: number;
  /** 지난 회차 사용량 */
  pu: number | null;
  /** 지난 회차 고지액 */
  ptotal: number | null;
  du: number | null;
  dt: number | null;
  judge: Judge;
};

export type Dash = {
  p: Period;
  prev: Period | null;
  r: CalcResult<Household>;
  pr: CalcResult<Household> | null;
  rows: DashRow[];
  ledger: Ledger;
  savedCount: number;
  /** 같은 순서로 구간별 해당 세대 수 */
  tierCounts: number[];
};

export function useDash(data: AppData, periodId: string): Dash | null {
  return useMemo(() => {
    const p = data.periods.find((x) => x.id === periodId);
    if (!p) return null;
    const prev = prevPeriodOf(data, p);
    const r = calcPeriod(p, data);
    const pr = prev ? calcPeriod(prev, data) : null;
    const pmap = new Map(pr?.rows.map((x) => [x.id, x]) ?? []);
    const rows: DashRow[] = r.rows.map((x, idx) => {
      const px = pmap.get(x.id);
      const pu = px?.u ?? null;
      const ptotal = px?.total ?? null;
      return {
        ...x,
        idx,
        pu,
        ptotal,
        du: x.u != null && pu != null ? x.u - pu : null,
        dt: x.total != null && ptotal != null ? x.total - ptotal : null,
        judge: judgeReading(Number(x.prev ?? 0), x.curr, pu),
      };
    });
    // 각 세대에 붙은 구간(가장 높은 기준 하나)을 p.tiers 순서로 센다
    const sorted = sortTiers(cfgOf(p, data.settings).tiers);
    const tierCounts = p.tiers.map(() => 0);
    for (const x of rows) {
      if (x.u == null) continue;
      const hit = sorted.find((s) => x.u! >= s.min);
      const i = hit ? p.tiers.findIndex((t) => t.min === hit.min) : -1;
      if (i >= 0) tierCounts[i] += 1;
    }
    const savedCount = rows.filter((x) => p.checked[x.id] && x.curr != null).length;
    return { p, prev, r, pr, rows, ledger: buildLedger(data), savedCount, tierCounts };
  }, [data, periodId]);
}
