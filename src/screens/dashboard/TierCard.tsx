import { TierEditor } from '../../components/TierEditor';
import { updatePeriod } from '../../lib/edit';
import { won } from '../../lib/format';
import { isLocked, periodLabel } from '../../lib/period';
import { useStore } from '../../store';
import type { Dash } from './derive';

export function TierCard({ d }: { d: Dash }) {
  const { update } = useStore();
  const { p, r, tierCounts } = d;
  return (
    <section className="card">
      <div className="hd">
        <h2>누진 부과금</h2>
        <span className="hint">{periodLabel(p)}</span>
      </div>
      <p className="lead">사용량이 기준 이상이면 가장 높은 구간 금액 하나만 붙습니다. 바꾸면 이 회차에만 적용됩니다. 고지서에는 수도요금에 합쳐서 나옵니다.</p>
      <div className="bd">
        <TierEditor
          tiers={p.tiers}
          counts={tierCounts}
          disabled={isLocked(p)}
          onChange={(tiers) => update((data) => updatePeriod(data, p.id, (q) => ({ ...q, tiers })))}
        />
        <p className="hint" style={{ margin: '8px 0 0' }}>
          누진 부과금 합계 <b>{r.ready ? `${won(r.surTotal)}원` : '–'}</b>
        </p>
      </div>
    </section>
  );
}
