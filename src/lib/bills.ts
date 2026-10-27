/* 고지서: A4 세로 한 장에 2세대, 검침 순서대로. 계좌·회사명은 설정(로컬)에서 읽는다. */
import type { Period, Settings } from './schema';

/** 두 세대씩 묶는다. 홀수면 마지막 장 아래칸은 빈다. */
export const pairUp = <T,>(rows: T[]): [T, T | null][] => {
  const pages: [T, T | null][] = [];
  for (let i = 0; i < rows.length; i += 2) pages.push([rows[i], rows[i + 1] ?? null]);
  return pages;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
/** 2026_07-08 */
export const fileTag = (p: Pick<Period, 'year' | 'm1'>) => `${p.year}_${pad2(p.m1)}-${pad2(p.m1 + 1)}`;
export const billFilename = (p: Pick<Period, 'year' | 'm1'>) => `수도요금_고지서_${fileTag(p)}.pdf`;

/** 고지서 아래 회사명: "(주)예그린" → "㈜ 예그린" (글자 간격은 CSS로 띄운다) */
export const companyStamp = (name: string) => name.trim().replace(/^\(\s*주\s*\)\s*/, '㈜ ');

export type BillInfo = { holder: string; bankLine: string; company: string; missing: string[] };

export function billInfo(s: Settings): BillInfo {
  const missing = [
    !s.bank.name.trim() && '은행명',
    !s.bank.no.trim() && '계좌번호',
    !s.bank.holder.trim() && '예금주',
    !s.companyName.trim() && '회사명',
  ].filter((x): x is string => !!x);
  const bankLine = [s.bank.name.trim(), s.bank.no.trim()].filter(Boolean).join(': ');
  return { holder: s.bank.holder.trim(), bankLine, company: companyStamp(s.companyName), missing };
}
