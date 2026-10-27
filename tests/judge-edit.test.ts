import { describe, expect, it } from 'vitest';
import { needsBackup, setCurr, setPrev, updatePeriod } from '../src/lib/edit';
import { judgeReading } from '../src/lib/judge';
import { confirmPeriod } from '../src/lib/period';
import { fakeData, fakePeriod } from './fake';

describe('검침값 판정', () => {
  it.each([
    [100, '', 10, 'empty'],
    [100, 95, 10, 'bad'],
    [100, 120, 10, 'warn'], // 2배 이상
    [100, 119, 10, 'ok'],
    [100, 108, 4, 'ok'], // 지난 회차 5㎥ 미만이면 2배 규칙을 쓰지 않는다
    [100, 100, 10, 'warn'], // 0㎥
    [100, 100, 4, 'ok'],
    [100, 200, null, 'warn'], // 100㎥ 이상
    [100, 199, null, 'ok'],
  ] as const)('전월 %s, 당월 %s, 지난 %s㎥ → %s', (prev, curr, pu, level) => {
    expect(judgeReading(prev, curr, pu).level).toBe(level);
  });
  it('오류와 경고에는 이유가 붙는다', () => {
    expect(judgeReading(10, 5, null).msg).toContain('전월값보다 작습니다');
    expect(judgeReading(0, 30, 10).msg).toContain('2배');
  });
});

describe('회차 수정', () => {
  it('당월값을 넣으면 저장됨, 지우면 해제', () => {
    const p = setCurr(fakePeriod(), 'A1', 123);
    expect(p.readings.A1.curr).toBe(123);
    expect(p.checked.A1).toBe(true);
    const q = setCurr(p, 'A1', null);
    expect(q.readings.A1.curr).toBe('');
    expect(q.checked.A1).toBe(false);
  });
  it('전월값을 고친다', () => {
    expect(setPrev(fakePeriod(), 'A1', 7).readings.A1.prev).toBe(7);
  });
  it('잠긴 회차는 바꾸지 않는다', () => {
    const d = confirmPeriod(fakeData(), '2030-03', '2030-04-30');
    expect(updatePeriod(d, '2030-03', (p) => ({ ...p, bill: 1 }))).toBe(d);
  });
});

describe('백업 알림', () => {
  it('확정한 뒤 백업하지 않았으면 알린다 (같은 날이어도 시각으로 비교)', () => {
    const d = confirmPeriod(fakeData(), '2030-03', '2030-04-30', '2030-04-30T09:00:00.000Z'); // 18:00 KST
    const at = (lastBackupAt: string) => ({ ...d, settings: { ...d.settings, lastBackupAt } });
    expect(needsBackup(fakeData())).toBe(false);
    expect(needsBackup(d)).toBe(true);
    expect(needsBackup(at('2030-04-30T19:00:00+09:00'))).toBe(false);
    expect(needsBackup(at('2030-04-30T08:00:00+09:00'))).toBe(true);
  });
  it('확정 시각이 없는 옛 회차는 백업이 한 번이라도 있으면 백업된 것으로 본다', () => {
    const d = fakeData({ periods: [fakePeriod({ status: 'closed' })] });
    expect(needsBackup(d)).toBe(true);
    expect(needsBackup({ ...d, settings: { ...d.settings, lastBackupAt: '2030-01-01T00:00:00+09:00' } })).toBe(false);
  });
});
