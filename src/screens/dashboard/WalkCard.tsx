/* 한 세대씩 검침 (아이폰 현장용). 입력 → [저장] → 이번 사용량 확인 → [다음 세대] */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { setCurr, updatePeriod } from '../../lib/edit';
import { formatInput, parseInput, signed, won } from '../../lib/format';
import { isLocked } from '../../lib/period';
import { EMPTY_MSG, walkSave, walkView } from '../../lib/walk';
import { useStore } from '../../store';
import type { Dash, DashRow } from './derive';

type Props = {
  d: Dash;
  idx: number;
  onIdx: (i: number) => void;
  /** 마지막 세대에서 [검침 끝] */
  onFinish: () => void;
};

const chipTone = (x: DashRow, saved: boolean) =>
  !saved ? '' : x.judge.level === 'bad' ? 'bad' : x.judge.level === 'warn' ? 'warn' : 'done';

export function WalkCard({ d, idx, onIdx, onFinish }: Props) {
  const { update } = useStore();
  const toast = useToast();
  const { p, rows, savedCount } = d;
  const n = rows.length;
  const i = Math.min(Math.max(idx, 0), Math.max(n - 1, 0));
  const h = rows[i];
  const locked = isLocked(p);
  const saved = !!h && !!p.checked[h.id] && h.curr != null;

  const [text, setText] = useState('');
  const [rejected, setRejected] = useState<number | null>(null);
  const [emptyTry, setEmptyTry] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // 세대가 바뀌면 저장된 값으로 입력칸을 채운다
  useEffect(() => {
    setText(h?.curr != null ? formatInput(String(h.curr)) : '');
    setRejected(null);
    setEmptyTry(false);
  }, [h?.id, p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    chips.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (!locked) input.current?.focus({ preventScroll: true });
  }, [i, locked]);

  if (!h) return <p className="note warn" style={{ margin: 16 }}>이 회차에 세대가 없습니다.</p>;

  const draft = parseInput(text);
  const v = walkView({ prev: Number(h.prev ?? 0), curr: h.curr ?? '', saved, pu: h.pu, draft, rejected, locked });
  const message = emptyTry && draft == null ? EMPTY_MSG : v.message;
  const msgTone = emptyTry && draft == null ? 'bad' : v.tone === 'none' ? (v.message ? 'warn' : '') : v.tone;
  const dongRows = rows.filter((x) => x.dong === h.dong);
  const posInDong = dongRows.findIndex((x) => x.id === h.id) + 1;
  const last = i === n - 1;

  const go = (k: number) => {
    onIdx(Math.min(Math.max(k, 0), n - 1));
    top.current?.scrollIntoView({ block: 'nearest' });
  };

  const save = () => {
    if (locked) return;
    const r = walkSave(Number(h.prev ?? 0), draft, h.pu);
    if (!r.ok) {
      if (r.reason === 'empty') setEmptyTry(true);
      else setRejected(draft);
      input.current?.focus({ preventScroll: true });
      return;
    }
    setRejected(null);
    setEmptyTry(false);
    update((data) => updatePeriod(data, p.id, (q) => setCurr(q, h.id, draft)));
  };

  const next = () => {
    if (!v.canNext) return;
    if (last) {
      toast(`검침 끝. ${savedCount}/${n}세대 저장했습니다.`);
      onFinish();
      return;
    }
    go(i + 1);
  };

  return (
    <div ref={top}>
      <div className="chips" ref={chips} role="toolbar" aria-label="세대 바로 가기">
        {rows.map((x, k) => {
          const s = !!p.checked[x.id] && x.curr != null;
          const sep = k === 0 || rows[k - 1].dong !== x.dong;
          return (
            <span key={x.id} style={{ display: 'contents' }}>
              {sep && <span className="sep">{x.dong}동</span>}
              <button
                className={`${chipTone(x, s)} ${k === i ? 'cur' : ''}`}
                aria-current={k === i ? 'true' : undefined}
                aria-label={`${x.id}${s ? ' 저장됨' : ''}`}
                onClick={() => go(k)}
              >
                {x.id.replace(/호$/, '')}
              </button>
            </span>
          );
        })}
      </div>

      <div className="walk">
        <div className="where">
          {h.dong}동 {posInDong}번째 · 전체 {i + 1}/{n} · 저장 {savedCount}세대
        </div>
        <div className="unit">{h.id}</div>

        <div className="ref">
          <div>
            <small>전월 검침값</small>
            <b>{won(h.prev)}</b>
          </div>
          <div className={`now ${v.tone === 'none' ? '' : v.tone}`} aria-live="polite">
            <small>이번 사용량</small>
            {v.shown && v.shown.u != null ? (
              <>
                <b>{won(v.shown.u)}㎥</b>
                <em>{v.shown.pu != null ? `지난 대비 ${signed(v.shown.u - v.shown.pu)}㎥` : ' '}</em>
              </>
            ) : (
              <>
                <b>–</b>
                <em>저장하면 표시</em>
              </>
            )}
          </div>
          <div>
            <small>지난 사용량</small>
            <b>{h.pu != null ? `${won(h.pu)}㎥` : '–'}</b>
          </div>
        </div>

        <input
          ref={input}
          className="walk-in"
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="당월 검침값 입력"
          aria-label={`${h.id} 당월 검침값`}
          value={text}
          disabled={locked}
          onChange={(e) => {
            setText(formatInput(e.target.value));
            setEmptyTry(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (v.enter === 'next') next();
            else save();
          }}
        />

        <div className={`wmsg ${msgTone}`} role="status">
          {message}
        </div>

        <div className="nav3">
          <button className="btn" disabled={i === 0} onClick={() => go(i - 1)}>
            ← 이전 세대
          </button>
          <button className={`btn ${!locked && v.enter === 'save' ? 'primary' : ''}`} disabled={locked} onClick={save}>
            저장
          </button>
          <button className={`btn ${v.canNext ? 'primary' : ''}`} disabled={!v.canNext} onClick={next}>
            {last ? '검침 끝' : '다음 세대 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
