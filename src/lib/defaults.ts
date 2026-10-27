/* 빈 상태로 시작할 때 쓰는 기본값. 세대 구성(호수·동·순서)만 둔다. 검침값·금액·계좌는 넣지 않는다. */
import { DEFAULT_TIERS } from './calc';
import type { AppData, Household, Settings } from './schema';

/** 검침 순서. 지4호는 폐지되어 없다. */
export const DONG1 = ['502호', '402호', '401호', '302호', '301호', '202호', '201호', '102호', '101호', '3호', '2호', '1호', '지1호'];
export const DONG2 = ['4호', '5호', '6호', '103호', '104호', '203호', '204호', '303호', '304호', '403호', '404호', '503호', '504호'];

export const defaultHouseholds = (): Household[] => [
  ...DONG1.map((id, i) => ({ id, dong: 1 as const, seq: i + 1, elecOn: true, active: true })),
  ...DONG2.map((id, i) => ({ id, dong: 2 as const, seq: i + 1, elecOn: true, active: true })),
];

export const defaultSettings = (): Settings => ({
  bank: { name: '', no: '', holder: '' },
  companyName: '',
  elecFee: 2500,
  roundUnit: 100,
  defaultTiers: [...DEFAULT_TIERS].reverse().map((t) => ({ ...t })),
  defaultMethod: 'avg',
});

export const emptyData = (): AppData => ({
  settings: defaultSettings(),
  households: defaultHouseholds(),
  periods: [],
  fund: { start: null, unit3: {}, expenses: [] },
});
