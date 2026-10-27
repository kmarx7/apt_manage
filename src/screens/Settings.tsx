/* 설정: 데이터 관리(백업·지속성·전체 삭제), 고지서 정보, 계산 기본값, 세대 관리 */
import { useEffect, useRef, useState } from 'react';
import { BackupImport } from '../components/BackupImport';
import { NumInput } from '../components/NumInput';
import { TierEditor } from '../components/TierEditor';
import { useToast } from '../components/Toast';
import { useBackupExport } from '../components/useBackupExport';
import type { PersistState } from '../lib/device';
import { dateTime } from '../lib/format';
import { addHousehold, moveHousehold, setActive, setElecOn } from '../lib/households';
import { sortHouseholds } from '../lib/period';
import type { Method, Settings as SettingsT } from '../lib/schema';
import { useData, useStore } from '../store';

export const METHOD_LABEL: Record<Method, string> = {
  avg: '평균 단가 (현행)',
  full: '누수 전액 배분',
  fullMinusN: '누진 수입 차감 후 전액 배분',
};

const PERSIST_LABEL: Record<PersistState, string> = {
  granted: '허용됨 — 브라우저가 임의로 지우지 않습니다',
  denied: '허용 안 됨 — 홈 화면에 추가해서 쓰고, 백업을 자주 저장하세요',
  unsupported: '이 브라우저는 지원하지 않음 — 백업을 자주 저장하세요',
};

function TextField({ label, value, onCommit, placeholder }: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="field">
      <label>
        {label}
        <input className="in" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v.trim())} />
      </label>
    </div>
  );
}

function DangerClear() {
  const { clear } = useStore();
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const arm = (n: number) => {
    setStep(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStep(0), 6000);
  };
  const labels = ['이 기기의 데이터 전체 삭제', '정말 지울까요? 한 번 더 누르세요', '마지막 확인: 모두 삭제'];
  return (
    <div className="actions">
      <button
        className={step === 0 ? 'btn danger-ghost' : 'btn danger'}
        onClick={() => (step < 2 ? arm(step + 1) : void clear())}
      >
        {labels[step]}
      </button>
      {step > 0 && (
        <button className="btn" onClick={() => setStep(0)}>
          취소
        </button>
      )}
    </div>
  );
}

function Households() {
  const data = useData();
  const { update } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [dong, setDong] = useState<1 | 2>(1);
  const sorted = sortHouseholds(data.households);

  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card">
      <div className="hd">
        <h2>세대 관리</h2>
        <span className="hint">활성 {data.households.filter((h) => h.active).length}세대</span>
      </div>
      <p className="lead">순서는 검침·표·고지서·엑셀 순서입니다. 세대는 지우지 않고 비활성으로 둡니다. 확정한 회차는 바뀌지 않고, 작성 중 회차에는 바로 반영됩니다.</p>
      <div className="hh-list">
        {([1, 2] as const).map((dg) => {
          const list = sorted.filter((h) => h.dong === dg);
          return (
            <div key={dg}>
              <div className="hh-dong">{dg}동</div>
              {list.map((h, i) => (
                <div className={h.active ? 'hh-row' : 'hh-row off'} key={h.id}>
                  <span className="seq">{h.seq}</span>
                  <span className="nm">{h.id}</span>
                  <span style={{ display: 'inline-flex', gap: 10 }}>
                    <label>
                      <input type="checkbox" checked={h.elecOn} onChange={(e) => update((d) => setElecOn(d, h.id, e.target.checked))} />
                      공동전기
                    </label>
                    <label>
                      <input type="checkbox" checked={h.active} onChange={(e) => update((d) => setActive(d, h.id, e.target.checked))} />
                      사용
                    </label>
                  </span>
                  <span className="mv">
                    <button className="btn small ghost" disabled={i === 0} aria-label={`${h.id} 위로`} onClick={() => update((d) => moveHousehold(d, h.id, -1))}>
                      ↑
                    </button>
                    <button className="btn small ghost" disabled={i === list.length - 1} aria-label={`${h.id} 아래로`} onClick={() => update((d) => moveHousehold(d, h.id, 1))}>
                      ↓
                    </button>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <form
        className="hh-add"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => {
            update((d) => addHousehold(d, name, dong));
            setName('');
          });
        }}
      >
        <input className="in" placeholder="호수 (예: 105호)" aria-label="추가할 호수" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="in" aria-label="동" value={dong} onChange={(e) => setDong(Number(e.target.value) as 1 | 2)}>
          <option value={1}>1동</option>
          <option value={2}>2동</option>
        </select>
        <button className="btn" type="submit" disabled={!name.trim()}>
          추가
        </button>
      </form>
    </section>
  );
}

export function Settings({ persist }: { persist: PersistState | null }) {
  const data = useData();
  const { update } = useStore();
  const exportBackup = useBackupExport();
  const s = data.settings;
  const setS = (patch: Partial<SettingsT>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  return (
    <div className="settings">
      <section className="card">
        <div className="hd">
          <h2>데이터 관리</h2>
        </div>
        <div className="bd">
          <div className="stat-line">
            <span>마지막 백업</span>
            <b>{s.lastBackupAt ? dateTime(s.lastBackupAt) : '아직 없음'}</b>
          </div>
          <div className="stat-line">
            <span>저장 지속성</span>
            <b>{persist ? PERSIST_LABEL[persist] : '확인 중…'}</b>
          </div>
          <div className="actions" style={{ margin: '10px 0 16px' }}>
            <button className="btn primary" onClick={() => void exportBackup()}>
              백업 파일 저장
            </button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            아이폰에서는 공유 시트가 열립니다. 에어드롭으로 맥에 보낸 뒤, 맥에서 ‘백업 불러오기’로 넣으세요.
          </p>
          <div className="field">
            <span className="lbl">백업 불러오기</span>
            <BackupImport overwrite />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="hd">
          <h2>고지서 정보</h2>
        </div>
        <div className="bd">
          <TextField label="은행명" value={s.bank.name} onCommit={(name) => setS({ bank: { ...s.bank, name } })} />
          <TextField label="계좌번호" value={s.bank.no} onCommit={(no) => setS({ bank: { ...s.bank, no } })} />
          <TextField label="예금주" value={s.bank.holder} onCommit={(holder) => setS({ bank: { ...s.bank, holder } })} />
          <TextField label="회사명 (고지서 아래)" value={s.companyName} onCommit={(companyName) => setS({ companyName })} />
          <p className="hint">이 정보는 이 기기에만 저장되고 고지서에만 쓰입니다.</p>
        </div>
      </section>

      <section className="card">
        <div className="hd">
          <h2>계산 기본값</h2>
        </div>
        <p className="lead">새로 만드는 회차에 적용합니다. 확정한 회차 금액은 바뀌지 않습니다.</p>
        <div className="bd">
          <div className="two">
            <div className="field">
              <label>
                공동전기 (세대당)
                <span className="unit-in">
                  <NumInput value={s.elecFee} onCommit={(v) => setS({ elecFee: v ?? 0 })} />
                  <span>원</span>
                </span>
              </label>
            </div>
            <div className="field">
              <label>
                올림 단위
                <select className="in" value={s.roundUnit} onChange={(e) => setS({ roundUnit: Number(e.target.value) })}>
                  {[1, 10, 100, 1000].map((u) => (
                    <option key={u} value={u}>
                      {u.toLocaleString('ko-KR')}원
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="field">
            <span className="lbl">기본 단가 방식</span>
            <div className="seg" role="radiogroup">
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                <label key={m}>
                  <input type="radio" name="defaultMethod" checked={s.defaultMethod === m} onChange={() => setS({ defaultMethod: m })} />
                  {METHOD_LABEL[m]}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lbl">기본 누진 구간</span>
            <TierEditor tiers={s.defaultTiers} onChange={(defaultTiers) => setS({ defaultTiers })} />
          </div>
        </div>
      </section>

      <Households />

      <section className="card danger-zone">
        <div className="hd">
          <h2>전체 삭제</h2>
        </div>
        <div className="bd">
          <p className="hint" style={{ marginTop: 0 }}>
            이 기기의 모든 회차·설정·기금 기록을 지웁니다. 되돌릴 수 없으니 먼저 백업 파일을 저장하세요.
          </p>
          <DangerClear />
        </div>
      </section>
    </div>
  );
}
