import { useEffect, useState } from 'react';
import { InstallHint } from './components/InstallHint';
import { TopBar, type View } from './components/TopBar';
import { requestPersist, type PersistState } from './lib/device';
import { sortPeriods } from './lib/period';
import { Dashboard } from './screens/dashboard/Dashboard';
import { FirstRun } from './screens/FirstRun';
import { Settings } from './screens/Settings';
import { useStore } from './store';

export function App() {
  const { phase, error, data } = useStore();
  const [view, setView] = useState<View>('dash');
  const [periodId, setPeriodId] = useState('');
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    void requestPersist().then(setPersist);
  }, []);

  // 처음 열 때와 데이터를 통째로 바꿨을 때는 마지막 회차를 보여 준다
  const ids = data?.periods.map((p) => p.id).join(',') ?? '';
  useEffect(() => {
    if (!data) return;
    if (!data.periods.some((p) => p.id === periodId)) setPeriodId(sortPeriods(data.periods).at(-1)?.id ?? '');
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'empty') setView('dash');
  }, [phase]);

  if (phase === 'loading') return null;
  if (phase === 'error')
    return (
      <div className="center-page">
        <p className="note bad err-page" role="alert">
          {error}
        </p>
      </div>
    );
  if (phase === 'empty') return <FirstRun />;

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <TopBar periodId={periodId} onPeriod={setPeriodId} view={view} onView={go} />
      <InstallHint />
      {error && (
        <div className="banner" role="alert">
          <div className="wrap">{error}</div>
        </div>
      )}
      <main className="wrap">
        {view === 'settings' && <Settings persist={persist} />}
        {view === 'dash' && periodId && <Dashboard periodId={periodId} />}
        {view === 'bills' && <p className="note info">고지서 미리보기는 6단계에서 들어옵니다.</p>}
      </main>
    </>
  );
}
