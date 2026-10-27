import { describe, expect, it } from 'vitest';
import { addHousehold, moveHousehold, setActive, setElecOn } from '../src/lib/households';
import { confirmPeriod, createNextPeriod, sortHouseholds } from '../src/lib/period';
import { fakeData } from './fake';

describe('세대 관리', () => {
  it('추가하면 동 맨 끝 순서로 들어가고 작성 중 회차에 전월 0으로 붙는다', () => {
    const d = addHousehold(fakeData(), ' A9 ', 1);
    expect(d.households.at(-1)).toEqual({ id: 'A9', dong: 1, seq: 3, elecOn: true, active: true });
    expect(d.periods[0].readings.A9).toEqual({ prev: 0, curr: '' });
  });
  it('같은 호수나 빈 이름은 막는다', () => {
    expect(() => addHousehold(fakeData(), 'A1', 1)).toThrow('이미');
    expect(() => addHousehold(fakeData(), '  ', 1)).toThrow();
  });
  it('확정 회차에는 손대지 않는다', () => {
    const d = addHousehold(confirmPeriod(fakeData(), '2030-03', '2030-04-30'), 'A9', 1);
    expect(d.periods[0].readings.A9).toBeUndefined();
  });
  it('비활성화하면 작성 중 회차에서 빠지고, 다시 켜면 마지막 당월값이 전월값', () => {
    const base = createNextPeriod(confirmPeriod(fakeData(), '2030-03', '2030-04-30'));
    const off = setActive(base, 'A2', false);
    expect(off.periods[1].readings.A2).toBeUndefined();
    expect(off.periods[0].readings.A2).toBeDefined();
    const on = setActive(off, 'A2', true);
    expect(on.periods[1].readings.A2).toEqual({ prev: 220, curr: '' });
  });
  it('순서는 같은 동 안에서만 바뀐다', () => {
    const d = moveHousehold(fakeData(), 'A2', -1);
    expect(sortHouseholds(d.households).map((h) => h.id)).toEqual(['A2', 'A1', 'B1']);
    expect(moveHousehold(d, 'A2', -1)).toBe(d);
    expect(moveHousehold(d, 'B1', 1)).toBe(d);
  });
  it('공동전기 부과 여부를 바꾼다', () => {
    expect(setElecOn(fakeData(), 'A2', true).households[1].elecOn).toBe(true);
  });
});
