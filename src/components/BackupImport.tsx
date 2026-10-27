/* 백업 불러오기: 파일 선택 → 검증·미리보기 → 확인 후 반영 */
import { useState } from 'react';
import { parseBackup, type ParseResult } from '../lib/backup';
import { dateTime } from '../lib/format';
import { useStore } from '../store';
import { useToast } from './Toast';

type Props = {
  /** 기존 데이터를 덮어쓰는 경우(설정 화면) 한 번 더 확인받는다 */
  overwrite: boolean;
  onDone?: () => void;
};

export function BackupImport({ overwrite, onDone }: Props) {
  const { replace } = useStore();
  const toast = useToast();
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(parseBackup(await file.text()));
  };

  const apply = async () => {
    if (!result?.ok) return;
    setBusy(true);
    try {
      await replace(result.data);
      toast('백업을 불러왔습니다.');
      setResult(null);
      onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="first-import" style={{ display: 'grid', gap: 10 }}>
      <label className="file-pick">
        <input
          type="file"
          accept="application/json,.json"
          aria-label="백업 파일 선택"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span className="btn">백업 파일 선택</span>
      </label>

      {result && !result.ok && (
        <p className="note bad" role="alert">
          {fileName}: {result.error}
        </p>
      )}

      {result?.ok && (
        <div className="preview">
          <dl>
            <dt>파일</dt>
            <dd>{fileName}</dd>
            <dt>내보낸 날짜</dt>
            <dd>{dateTime(result.preview.exportedAt)}</dd>
            <dt>회차</dt>
            <dd>
              {result.preview.periodCount}개
              {result.preview.firstPeriod && ` (${result.preview.firstPeriod} ~ ${result.preview.lastPeriod})`}
            </dd>
            <dt>세대</dt>
            <dd>{result.preview.householdCount}세대</dd>
          </dl>
          {overwrite && <p className="note warn">지금 이 기기에 있는 데이터를 모두 지우고 이 백업으로 바꿉니다.</p>}
          <div className="actions">
            <button className={overwrite ? 'btn danger' : 'btn primary'} disabled={busy} onClick={() => void apply()}>
              {overwrite ? '덮어쓰기' : '이 백업으로 시작'}
            </button>
            <button className="btn" disabled={busy} onClick={() => setResult(null)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
