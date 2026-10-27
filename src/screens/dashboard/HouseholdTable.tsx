/* 세대별 검침과 고지액 표. 동별로 묶고, 순서·증감·고지액으로 정렬한다. */
import { useRef, useState } from 'react';
import { NumInput } from '../../components/NumInput';
import { setCurr, setPrev, updatePeriod } from '../../lib/edit';
import { signed, won } from '../../lib/format';
import { isLocked } from '../../lib/period';
import { useStore } from '../../store';
import type { Dash, DashRow } from './derive';

type Sort = 'seq' | 'du' | 'total';

function Delta({ d, max }: { d: number | null; max: number }) {
  if (d == null) return <span style={{ color: 'var(--muted)' }}>–</span>;
  const w = max ? Math.min(1, Math.abs(d) / max) * 50 : 0;
  const cls = d > 0 ? 'up' : d < 0 ? 'down' : '';
  return (
    <span className="delta">
      <span className="track">{d !== 0 && <i className={cls} style={{ width: `${w}%` }} />}</span>
      <b className={cls}>{signed(d)}㎥</b>
    </span>
  );
}

function Tag({ x }: { x: DashRow }) {
  if (x.judge.level === 'bad') return <span className="tag bad" title={x.judge.msg}>전월보다 작음</span>;
  if (x.judge.level === 'warn') return <span className="tag warn" title={x.judge.msg}>다시 확인</span>;
  if (x.sur) return <span className="tag sur">누진 {won(x.sur)}</span>;
  return null;
}

export function HouseholdTable({ d }: { d: Dash }) {
  const { update } = useStore();
  const [sort, setSort] = useState<Sort>('seq');
  const body = useRef<HTMLTableSectionElement>(null);
  const { p, r, pr, rows } = d;
  const locked = isLocked(p);
  // 이전 회차가 없으면(첫 회차) 전월값도 입력받는다
  const prevEditable = !locked && d.prev == null;
  const maxU = Math.max(1, ...rows.map((x) => Math.abs(x.du ?? 0)));

  const edit = (fn: Parameters<typeof updatePeriod>[2]) => update((data) => updatePeriod(data, p.id, fn));
  const focusNext = (idx: number) => {
    const next = body.current?.querySelector<HTMLInputElement>(`input[data-idx="${idx + 1}"]`);
    if (next) {
      next.focus();
      next.select();
    }
  };

  const line = (x: DashRow) => (
    <tr key={x.id}>
      <td className="n" style={{ color: 'var(--muted)' }}>
        {x.idx + 1}
      </td>
      <td className="unit">{x.id}</td>
      <td className="n">
        {prevEditable ? (
          <NumInput className="read-in" value={x.prev ?? 0} aria-label={`${x.id} 전월`} onCommit={(v) => edit((q) => setPrev(q, x.id, v))} />
        ) : (
          won(x.prev)
        )}
      </td>
      <td className="n">
        <NumInput
          className="read-in"
          data-idx={x.idx}
          enterKeyHint="next"
          value={x.curr ?? ''}
          disabled={locked}
          aria-label={`${x.id} 당월`}
          onCommit={(v) => edit((q) => setCurr(q, x.id, v))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              focusNext(x.idx);
            }
          }}
        />
      </td>
      <td className="n">
        <b className={x.judge.level === 'bad' ? 'neg' : ''}>{x.u == null ? '' : `${won(x.u)}㎥`}</b>
      </td>
      <td className="n" style={{ color: 'var(--muted)' }}>
        {x.pu != null ? `${won(x.pu)}㎥` : '–'}
      </td>
      <td className="n">
        <Delta d={x.du} max={maxU} />
      </td>
      <td className="n">
        <b>{won(x.total)}</b>
      </td>
      <td className="n">
        {x.dt == null ? <span style={{ color: 'var(--muted)' }}>–</span> : <span className={x.dt > 0 ? 'up' : x.dt < 0 ? 'down' : ''}>{signed(x.dt)}</span>}
      </td>
      <td>
        <Tag x={x} />
      </td>
    </tr>
  );

  const group = (dong: 1 | 2) => {
    const list = rows.filter((x) => x.dong === dong);
    if (!list.length) return null;
    return [
      <tr className="dong" key={`d${dong}`}>
        <td colSpan={10}>
          {dong}동 · {list[0].id} → {list.at(-1)!.id}
        </td>
      </tr>,
      ...list.map(line),
    ];
  };

  const sorted =
    sort === 'seq'
      ? null
      : [...rows].sort((a, b) => (sort === 'du' ? (b.du ?? -1e9) - (a.du ?? -1e9) : (b.total ?? -1) - (a.total ?? -1)));

  const sumT = r.ready ? r.waterTotal + r.elecTotal : null;
  const sumPrevT = pr?.ready ? pr.waterTotal + pr.elecTotal : null;
  const sortBtn = (k: Sort, t: string) => (
    <button aria-sort={sort === k ? 'descending' : undefined} onClick={() => setSort(k)}>
      {t}
      {sort === k ? ' ↓' : ''}
    </button>
  );

  return (
    <div className="tbl-wrap">
      <table className="t">
        <thead>
          <tr>
            <th className="n">{sortBtn('seq', '순서')}</th>
            <th>호수</th>
            <th className="n">전월</th>
            <th className="n">당월</th>
            <th className="n">사용량</th>
            <th className="n">지난 회차</th>
            <th className="n">{sortBtn('du', '증감 ㎥')}</th>
            <th className="n">{sortBtn('total', '고지액')}</th>
            <th className="n">지난 대비</th>
            <th>확인</th>
          </tr>
        </thead>
        <tbody ref={body}>
          {sorted ? sorted.map(line) : [group(1), group(2)]}
          <tr className="sum">
            <td />
            <td>합계</td>
            <td />
            <td />
            <td className="n">{won(r.metered)}㎥</td>
            <td className="n">{pr?.ready ? `${won(pr.metered)}㎥` : '–'}</td>
            <td className="n">{pr?.ready ? `${signed(r.metered - pr.metered)}㎥` : '–'}</td>
            <td className="n">{won(sumT)}</td>
            <td className="n">{sumT != null && sumPrevT != null ? signed(sumT - sumPrevT) : '–'}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
