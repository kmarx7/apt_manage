/* 정산: 고지서 입력, 지난 회차 비교, 단가 방식, 추가조정, 계산 요약, 확정 */
import { useEffect, useState, type ReactNode } from 'react';
import { NumInput } from '../../components/NumInput';
import { useToast } from '../../components/Toast';
import { updatePeriod } from '../../lib/edit';
import { dec, dotDate, signed, today, won } from '../../lib/format';
import { calcPeriod, confirmPeriod, isLocked, monthsLabel, unconfirmPeriod } from '../../lib/period';
import type { Method, Period } from '../../lib/schema';
import { useData, useStore } from '../../store';
import { METHOD_LABEL } from '../Settings';
import type { Dash } from './derive';

function pctChange(a: number | null, b: number | null) {
  if (!a || !b) return '';
  return `${a >= b ? '+' : '−'}${dec(Math.abs(a / b - 1) * 100, 1)}%`;
}

function CompareRow({ name, now, before, digits = 0 }: { name: string; now: number | null; before: number | null; digits?: number }) {
  const has = now != null && now !== 0 && !Number.isNaN(now);
  const diff = has && before != null ? now - before : null;
  const show = (v: number | null) => (v == null ? '–' : digits ? dec(v, digits) : won(v));
  const pc = has ? pctChange(now, before) : '';
  return (
    <tr>
      <td>{name}</td>
      <td className="n">{show(before)}</td>
      <td className="n">
        <b>{has ? show(now) : '–'}</b>
      </td>
      <td className={`n ${diff == null ? '' : diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
        {diff == null ? '–' : `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${show(Math.abs(diff))}`}
        {pc && (
          <>
            <br />
            <small>{pc}</small>
          </>
        )}
      </td>
    </tr>
  );
}

function Compare({ d }: { d: Dash }) {
  const data = useData();
  const { p, prev, r } = d;
  if (!prev) return null;
  const qr = calcPeriod(prev, data);
  const all = r.filledCount === r.rows.length;
  return (
    <div className="field">
      <span className="lbl">
        지난 회차 대비 ({monthsLabel(prev.m1)} → {monthsLabel(p.m1)})
      </span>
      <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 7 }}>
        <table className="t cmp">
          <thead>
            <tr>
              <th />
              <th className="n">{monthsLabel(prev.m1)}</th>
              <th className="n">{monthsLabel(p.m1)}</th>
              <th className="n">증감</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow name="고지서 총액(원)" now={p.bill} before={prev.bill} />
            <CompareRow name="총사용량(㎥)" now={p.billQty} before={prev.billQty} />
            <CompareRow name="고지서 단가(원/㎥)" now={p.bill && p.billQty ? p.bill / p.billQty : null} before={prev.billQty ? prev.bill / prev.billQty : null} digits={1} />
            <CompareRow name="계량 합계(㎥)" now={all ? r.metered : null} before={qr.metered} />
            <CompareRow name="누수·미계량(㎥)" now={r.ready ? r.leak : null} before={qr.ready ? qr.leak : null} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Confirm({ d }: { d: Dash }) {
  const { update } = useStore();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const { p, r } = d;
  useEffect(() => setArmed(false), [p.id, p.status]);

  if (isLocked(p)) {
    return (
      <div className="actions" style={{ marginTop: 10, alignItems: 'center' }}>
        <span className="hint">
          {p.status === 'done' ? '확정' : '마감'} {dotDate(p.issued)}
        </span>
        {p.status === 'done' && (
          <button className="btn small" onClick={() => update((data) => unconfirmPeriod(data, p.id))}>
            확정 취소
          </button>
        )}
      </div>
    );
  }
  if (!r.ready) return null;
  const neg = d.rows.filter((x) => x.judge.level === 'bad');
  if (neg.length)
    return (
      <p className="note bad" style={{ margin: '10px 0 0' }}>
        당월값이 전월값보다 작은 세대가 있어 확정할 수 없습니다: {neg.map((x) => x.id).join(', ')}
      </p>
    );
  return (
    <>
      <div className="actions" style={{ marginTop: 10 }}>
        {armed ? (
          <>
            <button
              className="btn small primary"
              onClick={() => {
                try {
                  update((data) => confirmPeriod(data, p.id, today()));
                  toast('확정했습니다. 백업 파일을 저장하세요.');
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              확정합니다
            </button>
            <button className="btn small" onClick={() => setArmed(false)}>
              돌아가기
            </button>
          </>
        ) : (
          <>
            {r.breakEven != null && r.breakEven !== Number(p.adj) && (
              <button className="btn small" onClick={() => update((data) => updatePeriod(data, p.id, (q) => ({ ...q, adj: r.breakEven! })))}>
                조정 {signed(r.breakEven)}원 적용
              </button>
            )}
            <button className="btn small primary" onClick={() => setArmed(true)}>
              정산 확정
            </button>
          </>
        )}
      </div>
      {armed && (
        <p className="note warn" style={{ margin: '8px 0 0' }}>
          확정하면 금액, 누진 구간, 발행일({dotDate(today())})이 고정되고 차액이 기금 장부에 기록됩니다.
        </p>
      )}
    </>
  );
}

export function SettleCard({ d, exports }: { d: Dash; exports?: ReactNode }) {
  const { update } = useStore();
  const { p, r } = d;
  const lk = isLocked(p);
  const set = (patch: Partial<Period>) => update((data) => updatePeriod(data, p.id, (q) => ({ ...q, ...patch })));
  const [note, setNote] = useState(p.adjNote);
  useEffect(() => setNote(p.adjNote), [p.adjNote, p.id]);

  return (
    <section className="card">
      <div className="hd">
        <h2>정산</h2>
      </div>
      <div className="bd">
        <div className="two">
          <div className="field">
            <label htmlFor="bill">고지서 총액</label>
            <div className="unit-in">
              <NumInput id="bill" value={p.bill || ''} disabled={lk} onCommit={(v) => set({ bill: v ?? 0 })} />
              <span>원</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="billQty">총사용량</label>
            <div className="unit-in">
              <NumInput id="billQty" value={p.billQty || ''} disabled={lk} onCommit={(v) => set({ billQty: v ?? 0 })} />
              <span>㎥</span>
            </div>
          </div>
        </div>

        <Compare d={d} />

        <div className="field">
          <span className="lbl">단가 방식</span>
          <div className="seg" role="radiogroup" aria-label="단가 방식">
            {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
              <label key={m}>
                <input type="radio" name={`method-${p.id}`} checked={p.method === m} disabled={lk} onChange={() => set({ method: m })} />
                {METHOD_LABEL[m]}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="adj">추가조정</label>
          <div className="unit-in">
            <button className="btn small" disabled={lk} aria-label="10원 내리기" onClick={() => set({ adj: (Number(p.adj) || 0) - 10 })}>
              −
            </button>
            <NumInput id="adj" allowNegative value={p.adj} disabled={lk} onCommit={(v) => set({ adj: v ?? 0 })} />
            <span>원/㎥</span>
            <button className="btn small" disabled={lk} aria-label="10원 올리기" onClick={() => set({ adj: (Number(p.adj) || 0) + 10 })}>
              +
            </button>
          </div>
          <input
            className="in"
            style={{ marginTop: 6 }}
            placeholder="조정 사유 (예: 부족분 보전)"
            aria-label="조정 사유"
            value={note}
            disabled={lk}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== p.adjNote && set({ adjNote: note.trim() })}
          />
        </div>

        {r.ready ? (
          <div className="rows">
            <div className="r">
              <span>고지서 단가 · 계량 단가</span>
              <span>
                {dec(r.unitBill, 1)} · {dec(r.unitMeter, 1)}
              </span>
            </div>
            <div className="r">
              <span>기준 단가 · 적용 단가</span>
              <span>
                {dec(r.base, 2)} · {dec(r.P, 2)}원
              </span>
            </div>
            <div className="r">
              <span>사용요금 합계</span>
              <span>{won(r.useTotal)}원</span>
            </div>
            <div className="r">
              <span>누진 부과금 합계</span>
              <span>{won(r.surTotal)}원</span>
            </div>
            <div className="r">
              <span>세대 수도요금 합계</span>
              <span>{won(r.waterTotal)}원</span>
            </div>
            <div className="r">
              <span>고지서 총액</span>
              <span>{won(p.bill)}원</span>
            </div>
            <div className="r">
              <span>손익 0 조정값</span>
              <span>{signed(r.breakEven)}원</span>
            </div>
            <div className="r big">
              <span>수도 정산 차액</span>
              <span className={(r.diff ?? 0) >= 0 ? 'pos' : 'neg'}>
                {signed(r.diff)}원 <small style={{ fontWeight: 500 }}>{(r.diff ?? 0) >= 0 ? '기금 적립' : '기금 차감'}</small>
              </span>
            </div>
          </div>
        ) : (
          <p className="note warn" style={{ margin: 0 }}>
            {r.filledCount < r.rows.length ? `검침 ${r.rows.length - r.filledCount}세대가 남았습니다.` : r.metered <= 0 ? '계량 합계가 0입니다. 검침값을 확인하세요.' : '고지서 총액과 총사용량을 넣으세요.'}
          </p>
        )}

        <Confirm d={d} />

        {exports && (
          <div className="exports" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            {exports}
          </div>
        )}
      </div>
    </section>
  );
}
