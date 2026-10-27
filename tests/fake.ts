/* 테스트용 가상 데이터. 실제 세대·금액과 무관하다. */
import type { AppData, Household, Period } from '../src/lib/schema';

export const fakeHouseholds = (): Household[] => [
  { id: 'A1', dong: 1, seq: 1, elecOn: true, active: true },
  { id: 'A2', dong: 1, seq: 2, elecOn: false, active: true },
  { id: 'B1', dong: 2, seq: 1, elecOn: true, active: true },
];

export const fakePeriod = (over: Partial<Period> = {}): Period => ({
  id: '2030-03',
  year: 2030,
  m1: 3,
  status: 'draft',
  bill: 120000,
  billQty: 80,
  method: 'avg',
  adj: 0,
  adjNote: '',
  issued: null,
  tiers: [{ min: 20, fee: 2000 }, { min: 40, fee: 4000 }, { min: 50, fee: 5000 }],
  readings: { A1: { prev: 100, curr: 110 }, A2: { prev: 200, curr: 220 }, B1: { prev: 300, curr: 330 } },
  checked: {},
  ...over,
});

export const fakeData = (over: Partial<AppData> = {}): AppData => ({
  settings: {
    bank: { name: '테스트은행', no: '000-000', holder: '테스트' },
    companyName: '테스트관리',
    elecFee: 2500,
    roundUnit: 100,
    defaultTiers: [{ min: 20, fee: 2000 }, { min: 40, fee: 4000 }, { min: 50, fee: 5000 }],
    defaultMethod: 'avg',
  },
  households: fakeHouseholds(),
  periods: [fakePeriod()],
  fund: { start: 10000, unit3: {}, expenses: [], startPeriod: '2030-03' },
  ...over,
});
