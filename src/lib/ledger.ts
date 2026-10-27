/* 공동기금 장부. 회차 항목(수도 정산 차액, 공동전기 수입)은 저장하지 않고 회차 데이터에서 만든다. */
import { calcPeriod, periodLabel, sortPeriods } from './period';
import type { AppData } from './schema';

export type LedgerKind = '시작 잔액' | '수도 정산 차액' | '공동전기 수입' | '3호 공동전기 지급' | '공동경비 지출' | '기타 수입';

export type LedgerRow = {
  kind: LedgerKind;
  note: string;
  date: string | null;
  amount: number;
  /** 확정 전 회차에서 나온 예정 항목 */
  pending: boolean;
  /** 예정 포함 누적 잔액 */
  balance: number;
  periodId?: string;
  expenseId?: string;
};

export type Ledger = { rows: LedgerRow[]; confirmed: number; projected: number };

export function buildLedger(data: AppData): Ledger {
  const { fund } = data;
  const rows: Omit<LedgerRow, 'balance'>[] = [
    {
      kind: '시작 잔액',
      note: fund.start == null ? '시작 잔액 입력 필요' : fund.startNote || '',
      date: null,
      amount: fund.start ?? 0,
      pending: fund.start == null,
    },
  ];

  for (const p of sortPeriods(data.periods)) {
    if (fund.startPeriod && p.id < fund.startPeriod) continue;
    const r = calcPeriod(p, data);
    const pending = p.status === 'draft';
    if (r.ready && r.diff != null) {
      rows.push({ kind: '수도 정산 차액', note: periodLabel(p), date: p.issued, amount: r.diff, pending, periodId: p.id });
      const n = r.rows.filter((x) => x.elec > 0).length;
      rows.push({ kind: '공동전기 수입', note: `${periodLabel(p)} · ${n}세대`, date: p.issued, amount: r.elecTotal, pending, periodId: p.id });
    }
    const u = fund.unit3[p.id];
    if (u) rows.push({ kind: '3호 공동전기 지급', note: periodLabel(p), date: u.date || null, amount: -Math.abs(u.amount), pending: false, periodId: p.id });
  }

  for (const x of [...fund.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push({ kind: x.amount < 0 ? '공동경비 지출' : '기타 수입', note: x.note, date: x.date, amount: x.amount, pending: false, expenseId: x.id });
  }

  let confirmed = 0;
  let projected = 0;
  const withBalance = rows.map((r) => {
    projected += r.amount;
    if (!r.pending) confirmed += r.amount;
    return { ...r, balance: projected };
  });
  return { rows: withBalance, confirmed, projected };
}
