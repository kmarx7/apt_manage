/* 상단 바: 앱 이름, 회차 선택, 상태, 보기 전환, 새 회차. 새 회차 안내 띠와 백업 알림 띠도 여기서 띄운다. */
import { useState } from 'react';
import { needsBackup } from '../lib/edit';
import { today } from '../lib/format';
import { calcPeriod, confirmPeriod, createNextPeriod, monthsLabel, nextOf, periodLabel, sortPeriods } from '../lib/period';
import { useData, useStore } from '../store';
import { useToast } from './Toast';
import { useBackupExport } from './useBackupExport';

export type View = 'dash' | 'bills' | 'settings';

const STATUS = { draft: ['작성 중', 'draft'], done: ['확정', 'done'], closed: ['마감', 'closed'] } as const;

type Props = {
  periodId: string;
  onPeriod: (id: string) => void;
  view: View;
  onView: (v: View) => void;
};

export function TopBar({ periodId, onPeriod, view, onView }: Props) {
  const data = useData();
  const { update } = useStore();
  const toast = useToast();
  const exportBackup = useBackupExport();
  const [ask, setAsk] = useState(false);
  const ps = sortPeriods(data.periods);
  const cur = ps.find((p) => p.id === periodId);
  const last = ps.at(-1);
  const nx = last ? nextOf(last) : null;

  const createNext = (confirmFirst: boolean) => {
    if (!last || !nx) return;
    if (confirmFirst && !calcPeriod(last, data).ready) {
      setAsk(false);
      onPeriod(last.id);
      onView('dash');
      toast(`${monthsLabel(last.m1)} 검침과 고지서 입력을 먼저 마치세요.`);
      return;
    }
    update((d) => createNextPeriod(confirmFirst ? confirmPeriod(d, last.id, today()) : d));
    onPeriod(nx.id);
    onView('dash');
    setAsk(false);
    toast(`${nx.year}년 ${nx.label} 회차를 만들었습니다.`);
  };

  return (
    <>
      <header className="bar">
        <div className="wrap">
          <h1>예그린 수도정산</h1>
          {view !== 'settings' && cur && (
            <>
              <select aria-label="회차 선택" value={periodId} onChange={(e) => onPeriod(e.target.value)}>
                {ps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {periodLabel(p)}
                  </option>
                ))}
              </select>
              <span className={`pill ${STATUS[cur.status][1]}`}>{STATUS[cur.status][0]}</span>
            </>
          )}
          <div className="viewsw" role="group" aria-label="보기">
            <button aria-pressed={view === 'dash'} onClick={() => onView('dash')}>
              대시보드
            </button>
            <button aria-pressed={view === 'bills'} onClick={() => onView('bills')}>
              고지서
            </button>
            <button aria-pressed={view === 'settings'} onClick={() => onView('settings')}>
              설정
            </button>
          </div>
          {nx && (
            <button className="btn primary" id="newPeriod" onClick={() => setAsk(true)}>
              + 새 회차 ({nx.label})
            </button>
          )}
        </div>
      </header>

      {ask && last && nx && (
        <div className="banner" role="region" aria-label="새 회차">
          <div className="wrap">
            {last.status === 'draft' ? (
              <>
                <span>
                  {periodLabel(last)}이 아직 확정 전입니다. 확정하면 금액이 고정되고, 당월값이 {nx.label} 전월값으로 넘어갑니다.
                </span>
                <button className="btn small primary" onClick={() => createNext(true)}>
                  {monthsLabel(last.m1)} 확정하고 {nx.label} 만들기
                </button>
              </>
            ) : (
              <>
                <span>
                  {nx.year}년 {nx.label} 회차를 만듭니다. 전월값은 {periodLabel(last)} 당월값으로 채워집니다.
                </span>
                <button className="btn small primary" onClick={() => createNext(false)}>
                  만들기
                </button>
              </>
            )}
            <button className="btn small" onClick={() => setAsk(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {needsBackup(data) && (
        <div className="banner no-print" role="status">
          <div className="wrap">
            <span>확정한 회차가 있습니다. 백업 파일을 저장해 두세요.</span>
            <button className="btn small primary" onClick={() => void exportBackup()}>
              백업 파일 저장
            </button>
          </div>
        </div>
      )}
    </>
  );
}
