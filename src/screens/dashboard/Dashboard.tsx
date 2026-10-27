import type { ReactNode } from 'react';
import { periodLabel } from '../../lib/period';
import { useData } from '../../store';
import { useDash } from './derive';
import { FundCard } from './FundCard';
import { HouseholdTable } from './HouseholdTable';
import { Kpis } from './Kpis';
import { SettleCard } from './SettleCard';
import { TierCard } from './TierCard';

export function Dashboard({ periodId, exports }: { periodId: string; exports?: ReactNode }) {
  const data = useData();
  const d = useDash(data, periodId);
  if (!d) return null;
  return (
    <>
      <Kpis d={d} fundStartMissing={data.fund.start == null} />
      <div className="grid">
        <section className="card">
          <div className="hd">
            <h2>세대별 검침과 고지액</h2>
            <span className="hint">{d.prev ? `비교: ${periodLabel(d.prev)}` : '비교할 지난 회차 없음 · 전월값을 직접 입력하세요'}</span>
          </div>
          <HouseholdTable d={d} />
        </section>
        <div className="side">
          <SettleCard d={d} exports={exports} />
          <TierCard d={d} />
          <FundCard d={d} />
        </div>
      </div>
    </>
  );
}
