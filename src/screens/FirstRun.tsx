/* 최초 실행: 백업 파일로 시작하거나 빈 상태(기본 세대 목록만)로 시작 */
import { useState } from 'react';
import { BackupImport } from '../components/BackupImport';
import { InstallHint } from '../components/InstallHint';
import { emptyData } from '../lib/defaults';
import { createFirstPeriod, monthsLabel, periodStartOf } from '../lib/period';
import { useStore } from '../store';

export function FirstRun() {
  const { replace } = useStore();
  const [mode, setMode] = useState<'import' | 'empty' | null>(null);
  const start = periodStartOf(new Date());

  return (
    <>
      <InstallHint />
      <div className="center-page">
        <div className="first">
          <div>
            <h1>예그린 수도정산</h1>
            <p className="sub">이 기기에 저장된 데이터가 없습니다. 어떻게 시작할까요?</p>
          </div>

          <button className="choice" aria-pressed={mode === 'import'} onClick={() => setMode('import')}>
            <b>백업 파일 불러오기로 시작</b>
            <span>다른 기기에서 저장한 백업 파일(backup-수도정산-….json)을 불러옵니다. 아이폰은 에어드롭으로 받은 파일을 ‘파일’ 앱에서 고르세요.</span>
          </button>
          {mode === 'import' && <BackupImport overwrite={false} />}

          <button className="choice" aria-pressed={mode === 'empty'} onClick={() => setMode('empty')}>
            <b>빈 상태로 시작</b>
            <span>기본 세대 목록(26세대)만 넣고, 검침값과 금액은 비워 둡니다. 계좌·회사명은 설정에서 입력합니다.</span>
          </button>
          {mode === 'empty' && (
            <div className="preview">
              <p style={{ margin: 0 }}>
                첫 회차를 <b>{start.year}년 {monthsLabel(start.m1)}</b>로 만듭니다. 첫 회차는 전월 검침값도 직접 입력해야 합니다.
              </p>
              <div className="actions">
                <button className="btn primary" onClick={() => void replace(createFirstPeriod(emptyData(), start.year, start.m1))}>
                  빈 상태로 시작
                </button>
              </div>
            </div>
          )}

          <p className="hint">데이터는 이 기기의 브라우저 안에만 저장되고, 인터넷으로 보내지 않습니다.</p>
        </div>
      </div>
    </>
  );
}
