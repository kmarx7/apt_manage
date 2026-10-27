/* 화면에서 쓰는 데이터 수정 함수. 모두 새 객체를 돌려준다. 잠긴(확정·마감) 회차는 바꾸지 않는다. */
import { isLocked } from './period';
import type { AppData, Fund, Period } from './schema';

export const updatePeriod = (data: AppData, id: string, fn: (p: Period) => Period): AppData => {
  const p = data.periods.find((x) => x.id === id);
  if (!p || isLocked(p)) return data;
  return { ...data, periods: data.periods.map((x) => (x.id === id ? fn(x) : x)) };
};

/** 당월값 기록. 값이 있으면 저장됨으로 표시한다. */
export const setCurr = (p: Period, hid: string, curr: number | null): Period => {
  const r = p.readings[hid];
  if (!r) return p;
  return {
    ...p,
    readings: { ...p.readings, [hid]: { ...r, curr: curr ?? '' } },
    checked: { ...p.checked, [hid]: curr != null },
  };
};

/** 전월값 기록 (첫 회차처럼 이전 회차가 없을 때만 화면에서 연다) */
export const setPrev = (p: Period, hid: string, prev: number | null): Period => {
  const r = p.readings[hid];
  if (!r) return p;
  return { ...p, readings: { ...p.readings, [hid]: { ...r, prev: prev ?? 0 } } };
};

export const updateFund = (data: AppData, fn: (f: Fund) => Fund): AppData => ({ ...data, fund: fn(data.fund) });

/** 확정한 뒤 백업하지 않았으면 백업을 권한다. */
export const needsBackup = (data: AppData): boolean => {
  const locked = data.periods.filter((p) => p.status !== 'draft');
  if (!locked.length) return false;
  const last = data.settings.lastBackupAt ? Date.parse(data.settings.lastBackupAt) : NaN;
  if (Number.isNaN(last)) return true;
  return locked.some((p) => p.confirmedAt != null && Date.parse(p.confirmedAt) > last);
};

let seq = 0;
export const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;
