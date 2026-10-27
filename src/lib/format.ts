/* 숫자·날짜 표시. 금액과 검침값은 모두 1,000단위 콤마. */

const nf = (min: number, max: number) => new Intl.NumberFormat('ko-KR', { minimumFractionDigits: min, maximumFractionDigits: max });
const int = nf(0, 0);

/** 음수는 signed()와 같은 빼기 기호(−)로 표시한다 */
export const won = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n);
  return (r < 0 ? '−' : '') + int.format(Math.abs(r));
};

export const dec = (n: number | null | undefined, digits: number) =>
  n == null || Number.isNaN(n) ? '–' : nf(digits, digits).format(n);

/** 단가: 소수 1~2자리 */
export const price = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '–' : nf(1, 2).format(n);

export const signed = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return '–';
  const r = Math.round(n);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + int.format(Math.abs(r));
};

export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || Number.isNaN(n) ? '–' : `${dec(n * 100, digits)}%`;

/** 입력칸 표시용: 숫자와 맨 앞 '-'만 남기고 콤마를 붙인다. */
export const formatInput = (v: string, allowNegative = false): string => {
  const s = String(v ?? '').replace(allowNegative ? /[^\d-]/g : /[^\d]/g, '');
  const neg = allowNegative && s.startsWith('-');
  const digits = s.replace(/-/g, '').replace(/^0+(?=\d)/, '');
  if (digits === '') return neg ? '-' : '';
  return (neg ? '-' : '') + int.format(Number(digits));
};

/** 입력칸 값 → 숫자. 비어 있으면 null. */
export const parseInput = (v: string): number | null => {
  const s = String(v ?? '').replace(/[^\d-]/g, '');
  if (s === '' || s === '-') return null;
  const n = Number((s.startsWith('-') ? '-' : '') + s.replace(/-/g, ''));
  return Number.isFinite(n) ? n : null;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());

const parts = (s: string) => s.match(/^(\d{4})-(\d{2})-(\d{2})/);
/** 2026년 10월 27일 */
export const korDate = (s: string | null | undefined) => {
  const m = s ? parts(s) : null;
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : '';
};
/** 2026. 10. 27. */
export const dotDate = (s: string | null | undefined) => {
  const m = s ? parts(s) : null;
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : '';
};
/** 2026. 10. 27. 15:04 */
export const dateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${dotDate(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
