/* 백업 파일(JSON) 만들기와 읽기. 기기 간 이동은 이 파일 하나로 한다. */
import { normalizeData, periodLabel, sortPeriods } from './period';
import { APP_ID, BackupSchema, SCHEMA_VERSION, type AppData, type Backup } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');

/** backup-수도정산-YYYYMMDD-HHmm.json */
export const backupFilename = (d: Date) =>
  `backup-수도정산-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;

/** 현지 시각 + 시간대 표기 (예: 2026-10-27T15:04:00+09:00) */
export const isoLocal = (d: Date) => {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
};

export const makeBackup = (data: AppData, now: Date): Backup => ({
  app: APP_ID,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: isoLocal(now),
  settings: data.settings,
  households: data.households,
  periods: sortPeriods(data.periods),
  fund: data.fund,
});

export const backupBlob = (b: Backup) => new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });

export type BackupPreview = {
  exportedAt: string;
  periodCount: number;
  householdCount: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
};

export type ParseResult = { ok: true; data: AppData; preview: BackupPreview } | { ok: false; error: string };

/** 백업 파일 내용을 검증한다. 실패하면 사용자에게 보여 줄 이유를 돌려준다. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 파일이 아니거나 내용이 깨져 있습니다.' };
  }
  const r = BackupSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
    const appMismatch = issue.path[0] === 'app';
    return { ok: false, error: appMismatch ? '수도정산 앱의 백업 파일이 아닙니다.' : `백업 파일 형식이 맞지 않습니다${where}: ${issue.message}` };
  }
  const ids = new Set<string>();
  for (const p of r.data.periods) {
    if (ids.has(p.id)) return { ok: false, error: `같은 회차가 두 번 들어 있습니다 (${p.id})` };
    ids.add(p.id);
  }
  const { app: _a, schemaVersion: _v, exportedAt, ...rest } = r.data;
  // 불러온 데이터는 이 백업 파일에 이미 들어 있으므로, 내보낸 시각을 마지막 백업으로 본다
  const lastBackupAt = [rest.settings.lastBackupAt, exportedAt].filter(Boolean).sort().at(-1);
  const data = normalizeData({ ...rest, settings: { ...rest.settings, lastBackupAt } });
  const ps = sortPeriods(data.periods);
  return {
    ok: true,
    data,
    preview: {
      exportedAt,
      periodCount: ps.length,
      householdCount: data.households.filter((h) => h.active).length,
      firstPeriod: ps[0] ? periodLabel(ps[0]) : null,
      lastPeriod: ps.at(-1) ? periodLabel(ps.at(-1)!) : null,
    },
  };
}
