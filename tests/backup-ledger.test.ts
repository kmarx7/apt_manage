import { describe, expect, it } from 'vitest';
import { backupFilename, makeBackup, parseBackup } from '../src/lib/backup';
import { buildLedger } from '../src/lib/ledger';
import { confirmPeriod } from '../src/lib/period';
import { fakeData, fakePeriod } from './fake';

describe('백업 파일', () => {
  it('파일명 형식', () => {
    expect(backupFilename(new Date(2030, 0, 5, 9, 7))).toBe('backup-수도정산-20300105-0907.json');
  });

  it('저장한 백업을 다시 불러오면 같은 데이터', () => {
    const d = fakeData();
    const b = makeBackup(d, new Date(2030, 0, 5, 9, 7));
    expect(b).toMatchObject({ app: 'yegreen-water', schemaVersion: 1 });
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({ ...d, settings: { ...d.settings, lastBackupAt: b.exportedAt } });
    expect(r.preview).toMatchObject({ periodCount: 1, householdCount: 3, firstPeriod: '2030년 3·4월' });
  });

  it.each([
    ['깨진 JSON', '{', 'JSON'],
    ['다른 앱 파일', JSON.stringify({ app: 'other' }), '수도정산 앱의 백업 파일이 아닙니다'],
    ['필수 항목 빠짐', JSON.stringify({ ...makeBackup(fakeData(), new Date()), households: undefined }), 'households'],
    ['더 새 버전', JSON.stringify({ ...makeBackup(fakeData(), new Date()), schemaVersion: 99 }), '새 버전'],
    ['잘못된 동', JSON.stringify({ ...makeBackup(fakeData(), new Date()), households: [{ id: 'X', dong: 3, seq: 1, elecOn: true, active: true }] }), 'households'],
  ])('%s는 거부한다', (_, text, msg) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it('같은 회차가 두 번 있으면 거부한다', () => {
    const b = makeBackup(fakeData({ periods: [fakePeriod(), fakePeriod()] }), new Date());
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok).toBe(false);
  });
});

describe('공동기금 장부', () => {
  it('작성 중 회차는 예정으로 따로 잡힌다', () => {
    const L = buildLedger(fakeData());
    // 가상 회차: 수도요금 합계 109,000 − 고지서 120,000 = −11,000, 공동전기 2세대 5,000
    expect(L.rows.map((r) => [r.kind, r.amount, r.pending])).toEqual([
      ['시작 잔액', 10000, false],
      ['수도 정산 차액', -11000, true],
      ['공동전기 수입', 5000, true],
    ]);
    expect(L.confirmed).toBe(10000);
    expect(L.projected).toBe(4000);
  });

  it('확정하면 확정 잔액에 들어가고, 3호 지급·지출·수입이 반영된다', () => {
    const base = confirmPeriod(fakeData(), '2030-03', '2030-04-30');
    const d = {
      ...base,
      fund: {
        ...base.fund,
        unit3: { '2030-03': { amount: 3000, date: '2030-05-02' } },
        expenses: [
          { id: 'e2', date: '2030-05-10', note: '기타', amount: 700 },
          { id: 'e1', date: '2030-05-03', note: '청소', amount: -1500 },
        ],
      },
    };
    const L = buildLedger(d);
    expect(L.rows.map((r) => r.kind)).toEqual(['시작 잔액', '수도 정산 차액', '공동전기 수입', '3호 공동전기 지급', '공동경비 지출', '기타 수입']);
    expect(L.rows.every((r) => !r.pending)).toBe(true);
    expect(L.confirmed).toBe(10000 - 11000 + 5000 - 3000 - 1500 + 700);
    expect(L.rows.at(-1)!.balance).toBe(L.confirmed);
  });

  it('시작 잔액이 없으면 0으로 계산하고 예정으로 표시한다', () => {
    const L = buildLedger(fakeData({ fund: { start: null, unit3: {}, expenses: [] } }));
    expect(L.rows[0]).toMatchObject({ amount: 0, pending: true, note: '시작 잔액 입력 필요' });
  });

  it('시작 회차 이전 회차는 장부에 넣지 않는다', () => {
    const d = fakeData({ fund: { start: 0, unit3: {}, expenses: [], startPeriod: '2030-05' } });
    expect(buildLedger(d).rows).toHaveLength(1);
  });
});
