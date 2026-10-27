/* 누진 구간 편집: 기준 ㎥ 이상이면 금액. 구간별 해당 세대 수는 선택. */
import type { Tier } from '../lib/schema';
import { won } from '../lib/format';
import { NumInput } from './NumInput';

type Props = {
  tiers: Tier[];
  onChange: (tiers: Tier[]) => void;
  disabled?: boolean;
  /** 같은 순서로 구간별 해당 세대 수 */
  counts?: number[];
};

export function TierEditor({ tiers, onChange, disabled, counts }: Props) {
  const set = (i: number, t: Partial<Tier>) => onChange(tiers.map((x, k) => (k === i ? { ...x, ...t } : x)));
  const remove = (i: number) => onChange(tiers.filter((_, k) => k !== i));
  const add = () => {
    const top = tiers.reduce((m, t) => Math.max(m, t.min), 0);
    const fee = tiers.reduce((m, t) => Math.max(m, t.fee), 0);
    onChange([...tiers, { min: top + 10, fee: fee + 1000 }]);
  };

  return (
    <div>
      {tiers.map((t, i) => (
        <div className="tier" key={i}>
          <NumInput value={t.min} disabled={disabled} aria-label={`${i + 1}구간 기준 ㎥`} onCommit={(v) => set(i, { min: v ?? 0 })} />
          <span>㎥ 이상</span>
          <NumInput value={t.fee} disabled={disabled} aria-label={`${i + 1}구간 금액`} onCommit={(v) => set(i, { fee: v ?? 0 })} />
          <span className="cnt">{counts ? `${counts[i] ?? 0}세대` : '원'}</span>
          <button className="btn small ghost" disabled={disabled} aria-label={`${i + 1}구간 삭제`} onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      {tiers.length === 0 && <p className="hint">누진 구간이 없습니다.</p>}
      <div className="actions" style={{ marginTop: 6 }}>
        <button className="btn small" disabled={disabled} onClick={add}>
          + 구간 추가
        </button>
        {counts && <span className="hint">가장 높은 구간 금액 하나만 붙습니다. 최고 {won(Math.max(0, ...tiers.map((t) => t.fee)))}원</span>}
      </div>
    </div>
  );
}
