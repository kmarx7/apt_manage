import { describe, expect, it } from 'vitest';
import { CHANGED_MSG, SAVED_MSG, walkSave, walkView, type WalkInput } from '../src/lib/walk';

const base: WalkInput = { prev: 1000, curr: '', saved: false, pu: 10, draft: null, rejected: null, locked: false };

describe('한 세대씩 검침 상태', () => {
  it('입력 중에는 가운데 칸을 비우고 다음 세대를 막는다', () => {
    const v = walkView({ ...base, draft: 1012 });
    expect(v).toMatchObject({ shown: null, canNext: false, enter: 'save', message: '' });
  });

  it('저장하면 이번 사용량과 지난 대비가 나오고 다음 세대가 열린다', () => {
    const v = walkView({ ...base, curr: 1012, saved: true, draft: 1012 });
    expect(v.shown).toMatchObject({ u: 12, pu: 10, level: 'ok' });
    expect(v).toMatchObject({ tone: 'ok', canNext: true, enter: 'next', message: SAVED_MSG });
  });

  it('저장한 뒤 값을 고치면 다시 저장하라고 하고 다음 세대를 막는다', () => {
    const v = walkView({ ...base, curr: 1012, saved: true, draft: 1013 });
    expect(v).toMatchObject({ shown: null, canNext: false, enter: 'save', message: CHANGED_MSG });
  });

  it('음수 사용량은 저장을 거부하고 빨간색으로 이유를 보여 준다', () => {
    expect(walkSave(1000, 990, 10)).toMatchObject({ ok: false, reason: 'negative' });
    const v = walkView({ ...base, draft: 990, rejected: 990 });
    expect(v.shown?.u).toBe(-10);
    expect(v).toMatchObject({ tone: 'bad', canNext: false, enter: 'save' });
    expect(v.message).toContain('전월값보다 작습니다');
  });

  it('거부된 값을 고치면 빨간 표시가 사라진다', () => {
    expect(walkView({ ...base, draft: 1001, rejected: 990 }).tone).toBe('none');
  });

  it('경고(2배 이상, 0㎥, 100㎥ 이상)는 노란색으로 보여 주되 저장과 다음을 허용한다', () => {
    for (const curr of [1020, 1000, 1100]) {
      expect(walkSave(1000, curr, 10).ok).toBe(true);
      const v = walkView({ ...base, curr, saved: true, draft: curr });
      expect(v).toMatchObject({ tone: 'warn', canNext: true, enter: 'next' });
    }
  });

  it('빈 칸으로 저장하면 입력하라고 한다', () => {
    expect(walkSave(1000, null, 10)).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('표에서 음수로 저장된 값이면 다음 세대를 막는다', () => {
    const v = walkView({ ...base, curr: 990, saved: true, draft: 990 });
    expect(v).toMatchObject({ tone: 'bad', canNext: false, enter: 'save' });
  });

  it('확정된 회차는 입력 없이 넘겨 볼 수 있다', () => {
    const v = walkView({ ...base, curr: 1012, saved: true, draft: 1012, locked: true });
    expect(v).toMatchObject({ canNext: true, enter: 'next', tone: 'ok' });
  });
});
