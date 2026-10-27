/* 세대 관리: 추가, 비활성화, 순서 변경. 과거 회차 기록을 지키려고 삭제는 하지 않는다.
 * 확정·마감 회차는 그대로 두고, 작성 중 회차에만 바로 반영한다. */
import { sortHouseholds, sortPeriods } from './period';
import type { AppData, Household, Period } from './schema';

const lastKnownCurr = (data: AppData, id: string, before: Period): number => {
  const prior = sortPeriods(data.periods).filter((p) => p.id < before.id && p.readings[id]);
  const r = prior.at(-1)?.readings[id];
  if (!r) return 0;
  return r.curr === '' ? r.prev : r.curr;
};

const mapDrafts = (data: AppData, fn: (p: Period) => Period): Period[] =>
  data.periods.map((p) => (p.status === 'draft' ? fn(p) : p));

export function addHousehold(data: AppData, id: string, dong: 1 | 2): AppData {
  const name = id.trim();
  if (!name) throw new Error('호수를 입력하세요');
  if (data.households.some((h) => h.id === name)) throw new Error('이미 있는 호수입니다');
  const seq = Math.max(0, ...data.households.filter((h) => h.dong === dong).map((h) => h.seq)) + 1;
  const h: Household = { id: name, dong, seq, elecOn: true, active: true };
  return {
    ...data,
    households: [...data.households, h],
    periods: mapDrafts(data, (p) => ({ ...p, readings: { ...p.readings, [name]: { prev: 0, curr: '' } } })),
  };
}

export function setActive(data: AppData, id: string, active: boolean): AppData {
  return {
    ...data,
    households: data.households.map((h) => (h.id === id ? { ...h, active } : h)),
    periods: mapDrafts(data, (p) => {
      if (active) {
        if (p.readings[id]) return p;
        return { ...p, readings: { ...p.readings, [id]: { prev: lastKnownCurr(data, id, p), curr: '' } } };
      }
      const { [id]: _r, ...readings } = p.readings;
      const { [id]: _c, ...checked } = p.checked;
      return { ...p, readings, checked };
    }),
  };
}

export function setElecOn(data: AppData, id: string, elecOn: boolean): AppData {
  return { ...data, households: data.households.map((h) => (h.id === id ? { ...h, elecOn } : h)) };
}

/** 같은 동 안에서 한 칸 위(-1)나 아래(+1)로 옮긴다. */
export function moveHousehold(data: AppData, id: string, dir: -1 | 1): AppData {
  const h = data.households.find((x) => x.id === id);
  if (!h) return data;
  const same = sortHouseholds(data.households.filter((x) => x.dong === h.dong));
  const i = same.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= same.length) return data;
  const swapped = [...same];
  [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
  const seqOf = new Map(swapped.map((x, k) => [x.id, k + 1]));
  return { ...data, households: data.households.map((x) => (seqOf.has(x.id) ? { ...x, seq: seqOf.get(x.id)! } : x)) };
}
