/* 한 세대씩 검침의 화면 상태. 입력 → [저장] → 가운데 칸에 이번 사용량 → [다음 세대]. */
import { judgeReading, type Judge } from './judge';

export type WalkInput = {
  prev: number;
  /** 저장된 당월값 */
  curr: number | '';
  saved: boolean;
  /** 지난 회차 사용량 */
  pu: number | null;
  /** 입력칸에 지금 있는 값 */
  draft: number | null;
  /** 저장을 눌렀지만 거부된 값 (음수 사용량) */
  rejected: number | null;
  locked: boolean;
};

export type WalkView = {
  /** 가운데 칸: null이면 "저장하면 표시" */
  shown: Judge | null;
  tone: 'none' | 'ok' | 'warn' | 'bad';
  message: string;
  canNext: boolean;
  /** 엔터를 누르면 할 일 */
  enter: 'save' | 'next';
};

export const SAVED_MSG = '저장했습니다. 다음 세대로 넘어가세요.';
export const CHANGED_MSG = '값이 바뀌었습니다. 저장을 다시 누르세요.';
export const EMPTY_MSG = '당월 검침값을 입력하세요.';

export function walkView(w: WalkInput): WalkView {
  if (w.locked) {
    const j = w.saved ? judgeReading(w.prev, w.curr, w.pu) : null;
    return { shown: j, tone: j ? toneOf(j) : 'none', message: '확정된 회차라 고칠 수 없습니다.', canNext: true, enter: 'next' };
  }
  const same = w.saved && w.curr !== '' && w.draft === w.curr;
  if (same) {
    const j = judgeReading(w.prev, w.curr, w.pu);
    const bad = j.level === 'bad';
    return { shown: j, tone: toneOf(j), message: j.msg ?? SAVED_MSG, canNext: !bad, enter: bad ? 'save' : 'next' };
  }
  if (w.rejected != null && w.draft === w.rejected) {
    const j = judgeReading(w.prev, w.rejected, w.pu);
    return { shown: j, tone: 'bad', message: j.msg ?? '', canNext: false, enter: 'save' };
  }
  const changed = w.saved && w.draft != null && w.draft !== w.curr;
  return { shown: null, tone: 'none', message: changed ? CHANGED_MSG : '', canNext: false, enter: 'save' };
}

/** [저장]을 눌렀을 때: 저장할지, 거부할지 */
export function walkSave(prev: number, draft: number | null, pu: number | null): { ok: true; judge: Judge } | { ok: false; reason: 'empty' | 'negative'; judge?: Judge } {
  if (draft == null) return { ok: false, reason: 'empty' };
  const j = judgeReading(prev, draft, pu);
  if (j.level === 'bad') return { ok: false, reason: 'negative', judge: j };
  return { ok: true, judge: j };
}

const toneOf = (j: Judge): WalkView['tone'] => (j.level === 'bad' ? 'bad' : j.level === 'warn' ? 'warn' : j.level === 'ok' ? 'ok' : 'none');
