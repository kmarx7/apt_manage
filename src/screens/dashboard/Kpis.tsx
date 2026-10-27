import { pct, price, signed, won } from '../../lib/format';
import type { Dash } from './derive';

const tone = (n: number | null | undefined) => (n == null ? '' : n > 0 ? 'pos' : n < 0 ? 'neg' : '');

export function Kpis({ d, fundStartMissing }: { d: Dash; fundStartMissing: boolean }) {
  const { p, r, pr, rows, savedCount, ledger } = d;
  const n = rows.length;
  const prevOk = pr?.ready ? pr : null;
  return (
    <div className="kpis">
      <div className="kpi">
        <div className="k">검침 저장</div>
        <div className="v">
          {savedCount}/{n}
        </div>
        <div className="bar-mini">
          <i style={{ width: `${n ? (savedCount / n) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="kpi">
        <div className="k">계량 합계</div>
        <div className="v">{won(r.metered)}㎥</div>
        <div className="s">{prevOk ? `지난 회차 ${won(prevOk.metered)}㎥ (${signed(r.metered - prevOk.metered)})` : ' '}</div>
      </div>
      <div className="kpi">
        <div className="k">누수·미계량</div>
        <div className="v">{r.ready ? pct(r.leakRate) : '–'}</div>
        <div className="s">
          {r.ready ? `${won(r.leak)}㎥` : '고지서 입력 후'}
          {prevOk && r.ready ? ` · 지난 ${pct(prevOk.leakRate)}` : ''}
        </div>
      </div>
      <div className="kpi">
        <div className="k">적용 단가</div>
        <div className="v">{price(r.P)}</div>
        <div className="s">원/㎥ · 조정 {signed(p.adj)}</div>
      </div>
      <div className="kpi">
        <div className="k">수도 정산 차액</div>
        <div className={`v ${tone(r.diff)}`}>{signed(r.diff)}</div>
        <div className="s">{r.ready ? `손익 0 조정값 ${signed(r.breakEven)}원` : ' '}</div>
      </div>
      <div className="kpi">
        <div className="k">기금 잔액</div>
        <div className={`v ${ledger.projected < 0 ? 'neg' : ''}`}>{won(ledger.projected)}</div>
        <div className="s">{fundStartMissing ? '시작 잔액 입력 필요' : `예정 포함 · 확정 ${won(ledger.confirmed)}`}</div>
      </div>
    </div>
  );
}
