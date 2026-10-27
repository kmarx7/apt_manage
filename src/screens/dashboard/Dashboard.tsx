import { useEffect, useState, type ReactNode } from 'react';
import { periodLabel } from '../../lib/period';
import { useData } from '../../store';
import { useDash } from './derive';
import { FundCard } from './FundCard';
import { HouseholdTable } from './HouseholdTable';
import { Kpis } from './Kpis';
import { SettleCard } from './SettleCard';
import { TierCard } from './TierCard';
import { WalkCard } from './WalkCard';

/** 휴대폰 폭에서는 한 세대씩 검침이 기본 */
const isPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 700px)').matches;

export function Dashboard({ periodId, exports }: { periodId: string; exports?: ReactNode }) {
  const data = useData();
  const d = useDash(data, periodId);
  const [walk, setWalk] = useState(isPhone);
  const [walkIdx, setWalkIdx] = useState(0);

  // 회차를 바꾸면 첫 세대부터. 아직 저장 안 한 첫 세대가 있으면 거기서 시작한다
  useEffect(() => {
    if (!d) return;
    const first = d.rows.findIndex((x) => !(d.p.checked[x.id] && x.curr != null));
    setWalkIdx(first >= 0 ? first : 0);
  }, [periodId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null;
  return (
    <>
      <Kpis d={d} fundStartMissing={data.fund.start == null} />
      <div className="grid">
        <section className="card">
          <div className="hd">
            <h2>세대별 검침과 고지액</h2>
            <span className="hint hide-phone">{d.prev ? `비교: ${periodLabel(d.prev)}` : '비교할 지난 회차 없음 · 전월값을 표에서 입력하세요'}</span>
            <div className="viewsw" role="group" aria-label="검침 보기">
              <button aria-pressed={!walk} onClick={() => setWalk(false)}>
                표
              </button>
              <button aria-pressed={walk} onClick={() => setWalk(true)}>
                한 세대씩 검침
              </button>
            </div>
          </div>
          {walk ? (
            <WalkCard
              d={d}
              idx={walkIdx}
              onIdx={setWalkIdx}
              onFinish={() => {
                setWalk(false);
                window.scrollTo({ top: 0 });
              }}
            />
          ) : (
            <HouseholdTable d={d} />
          )}
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
