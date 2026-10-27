/* 공동기금: 시작 잔액, 3호 공동전기 지급, 공동경비·기타, 장부 */
import { useEffect, useState } from 'react';
import { NumInput } from '../../components/NumInput';
import { useToast } from '../../components/Toast';
import { newId, updateFund } from '../../lib/edit';
import { dotDate, signed, today, won } from '../../lib/format';
import { periodLabel } from '../../lib/period';
import { useData, useStore } from '../../store';
import type { Dash } from './derive';

const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

function Unit3({ periodId, label }: { periodId: string; label: string }) {
  const { fund } = useData();
  const { update } = useStore();
  const toast = useToast();
  const cur = fund.unit3[periodId];
  const [amount, setAmount] = useState<number | null>(cur?.amount ?? null);
  const [date, setDate] = useState(cur?.date ?? today());
  useEffect(() => {
    setAmount(cur?.amount ?? null);
    setDate(cur?.date ?? today());
  }, [cur, periodId]);

  const save = () => {
    update((d) =>
      updateFund(d, (f) => {
        const { [periodId]: _old, ...rest } = f.unit3;
        return { ...f, unit3: amount && amount > 0 ? { ...rest, [periodId]: { amount, date } } : rest };
      }),
    );
    toast(amount && amount > 0 ? '3호 지급을 기록했습니다.' : '3호 지급 기록을 지웠습니다.');
  };

  return (
    <div className="field">
      <span className="lbl">3호 공동전기 지급 · {label}</span>
      <span className="hint">3호가 자기 사용분을 빼고 청구한 금액. 기금에서 나갑니다.</span>
      <div className="unit-in">
        <NumInput value={amount ?? ''} placeholder="3호 청구액" aria-label="3호 지급 금액" onCommit={setAmount} onDraft={setAmount} />
        <span>원</span>
      </div>
      <div className="unit-in">
        <input className="in" type="date" aria-label="3호 지급일" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn small" onClick={save}>
          {cur ? '수정' : '기록'}
        </button>
      </div>
    </div>
  );
}

function AddExpense() {
  const { update } = useStore();
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const ok = note.trim() !== '' && amount != null && amount !== 0;
  return (
    <form
      className="field"
      style={{ margin: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        update((d) => updateFund(d, (f) => ({ ...f, expenses: [...f.expenses, { id: newId(), date, note: note.trim(), amount: amount! }] })));
        setNote('');
        setAmount(null);
      }}
    >
      <span className="lbl">공동경비 · 기타 수입</span>
      <span className="hint">지출은 마이너스(−15,000), 수입은 플러스로 넣으세요.</span>
      <input className="in" placeholder="내용" aria-label="내용" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="unit-in">
        <NumInput allowNegative value={amount ?? ''} placeholder="-15,000" aria-label="금액" onCommit={setAmount} onDraft={setAmount} />
        <input className="in" type="date" aria-label="날짜" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn small" type="submit" disabled={!ok}>
          추가
        </button>
      </div>
    </form>
  );
}

export function FundCard({ d }: { d: Dash }) {
  const data = useData();
  const { update } = useStore();
  const { fund } = data;
  const L = d.ledger;
  const [armDel, setArmDel] = useState<string | null>(null);

  return (
    <section className="card">
      <div className="hd">
        <h2>공동기금</h2>
        <span className={tone(L.confirmed)} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {won(L.confirmed)}원
        </span>
      </div>
      <div className="bd">
        <div className="rows" style={{ marginBottom: 12 }}>
          <div className="r">
            <span>확정분 잔액</span>
            <span className={tone(L.confirmed)}>{won(L.confirmed)}원</span>
          </div>
          <div className="r">
            <span>예정 포함 잔액</span>
            <span className={tone(L.projected)}>{won(L.projected)}원</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="fundStart">시작 잔액 (지금 모아 둔 금액, 부족하면 마이너스)</label>
          <NumInput
            id="fundStart"
            allowNegative
            value={fund.start ?? ''}
            placeholder="예: -35,000"
            onCommit={(v) => update((x) => updateFund(x, (f) => ({ ...f, start: v })))}
          />
        </div>
        <Unit3 periodId={d.p.id} label={periodLabel(d.p)} />
        <AddExpense />
      </div>
      <div className="ledger">
        {[...L.rows].reverse().map((x, i) => (
          <div className={x.pending ? 'li pend' : 'li'} key={`${x.kind}-${x.periodId ?? x.expenseId ?? ''}-${i}`}>
            <span>{x.kind}</span>
            <span className={`a ${tone(x.amount)}`}>
              {signed(x.amount)}
              {x.expenseId && (
                <button
                  className="btn small ghost"
                  style={{ marginLeft: 4, padding: '0 6px', minHeight: 0 }}
                  aria-label={`${x.note} 삭제`}
                  onClick={() => {
                    if (armDel !== x.expenseId) return setArmDel(x.expenseId!);
                    update((dd) => updateFund(dd, (f) => ({ ...f, expenses: f.expenses.filter((e) => e.id !== x.expenseId) })));
                    setArmDel(null);
                  }}
                >
                  {armDel === x.expenseId ? '삭제?' : '✕'}
                </button>
              )}
            </span>
            <small>
              {x.date ? `${dotDate(x.date)} · ` : x.pending ? '예정 · ' : ''}
              {x.note}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
