/* 엑셀 저장 내용: 시트 4개(정산표, 정산 요약, 세대별, 기금 장부)의 칸 값과 숫자 서식. 파일 쓰기는 xlsx.ts가 한다. */
import { fileTag } from './bills';
import { buildStatementSheet, type GridSpec } from './xlsxStatement';
import { dotDate } from './format';
import { buildLedger } from './ledger';
import { calcPeriod, cfgOf, monthsLabel, periodLabel, prevPeriodOf } from './period';
import { sortTiers } from './calc';
import type { AppData, Method } from './schema';

export const NF = { int: '#,##0', price: '#,##0.00', pct: '0.0%', neg: '#,##0;[Red]-#,##0' } as const;
export type Fmt = (typeof NF)[keyof typeof NF];
export type Cell = string | number | null;
export type SheetRow = { cells: Cell[]; fmts?: (Fmt | null)[]; bold?: boolean };
/** center: 가운데 정렬할 열 번호(0부터) */
export type SheetSpec = { name: string; title: string; widths: number[]; header?: string[]; rows: SheetRow[]; center?: number[] };
/** 표 시트(SheetSpec) 또는 칸 위치를 직접 정하는 시트(GridSpec, 정산표) */
export type AnySheet = SheetSpec | GridSpec;

const STATUS = { draft: '작성 중', done: '확정', closed: '마감' } as const;
const METHOD: Record<Method, string> = { avg: '평균 단가 (현행)', full: '누수 전액 배분', fullMinusN: '누진 수입 차감 후 전액 배분' };

export const xlsxFilename = (p: { year: number; m1: number }) => `수도요금_정산_${fileTag(p)}.xlsx`;

const diffOrNull = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? a - b : null);

export function buildWorkbookSpec(data: AppData, periodId: string): [GridSpec, ...SheetSpec[]] {
  const p = data.periods.find((x) => x.id === periodId);
  if (!p) throw new Error('회차를 찾을 수 없습니다');
  const r = calcPeriod(p, data);
  const prev = prevPeriodOf(data, p);
  const pr = prev ? calcPeriod(prev, data) : null;
  const label = periodLabel(p);

  // 1. 정산 요약 (키-값)
  const kv = (k: string, v: Cell, fmt: Fmt | null = null): SheetRow => ({ cells: [k, v], fmts: [null, typeof v === 'number' ? fmt : null] });
  const tiers = sortTiers(cfgOf(p, data.settings).tiers).reverse();
  const summary: SheetSpec = {
    name: '정산 요약',
    title: `${label} 정산 요약`,
    widths: [24, 26],
    rows: [
      kv('상태', STATUS[p.status]),
      kv('발행일', p.issued ? dotDate(p.issued) : '확정 전'),
      kv('고지서 총액(원)', p.bill, NF.int),
      kv('고지서 총사용량(㎥)', p.billQty, NF.int),
      kv('세대 계량 합계(㎥)', r.metered, NF.int),
      kv('누수·미계량(㎥)', r.ready ? r.leak : null, NF.int),
      kv('누수율', r.ready ? r.leakRate : null, NF.pct),
      kv('고지서 단가(원/㎥)', r.unitBill, NF.price),
      kv('계량 단가(원/㎥)', r.unitMeter, NF.price),
      kv('단가 방식', METHOD[p.method]),
      kv('기준 단가(원/㎥)', r.base, NF.price),
      kv('추가조정(원/㎥)', Number(p.adj) || 0, NF.int),
      kv('조정 사유', p.adjNote || ''),
      kv('적용 단가(원/㎥)', r.P, NF.price),
      kv('사용요금 합계(원)', r.ready ? r.useTotal : null, NF.int),
      kv('누진 부과금 합계(원)', r.ready ? r.surTotal : null, NF.int),
      kv('세대 수도요금 합계(원)', r.ready ? r.waterTotal : null, NF.int),
      kv('공동전기 합계(원)', r.ready ? r.elecTotal : null, NF.int),
      kv('고지액 합계(원)', r.ready ? r.waterTotal + r.elecTotal : null, NF.int),
      kv('수도 정산 차액(원)', r.diff, NF.int),
      kv('손익 0 조정값(원/㎥)', r.breakEven, NF.int),
      { cells: [] },
      { cells: ['누진 구간', '부과 금액(원)'], bold: true },
      ...tiers.map((t) => kv(`${t.min.toLocaleString('ko-KR')}㎥ 이상`, t.fee, NF.int)),
    ],
  };

  // 2. 세대별
  const pmap = new Map(pr?.rows.map((x) => [x.id, x]) ?? []);
  const I = NF.int;
  const rowFmts: (Fmt | null)[] = [I, null, null, I, I, I, I, I, I, I, I, I, I, I, I];
  const hh = r.rows.map((x, i): SheetRow => {
    const px = pmap.get(x.id);
    return {
      cells: [
        i + 1, `${x.dong}동`, x.id, x.prev ?? null, x.curr, x.u, px?.u ?? null, diffOrNull(x.u, px?.u),
        x.use, x.sur, x.water, x.elec, x.total, px?.total ?? null, diffOrNull(x.total, px?.total),
      ],
      fmts: rowFmts,
    };
  });
  const prevSum = pr?.ready ? pr.waterTotal + pr.elecTotal : null;
  const sum = r.ready ? r.waterTotal + r.elecTotal : null;
  hh.push({
    cells: [
      null, null, '합계', null, null, r.metered, pr ? pr.metered : null, pr ? r.metered - pr.metered : null,
      r.ready ? r.useTotal : null, r.ready ? r.surTotal : null, r.ready ? r.waterTotal : null, r.ready ? r.elecTotal : null,
      sum, prevSum, diffOrNull(sum, prevSum),
    ],
    fmts: rowFmts,
    bold: true,
  });
  const households: SheetSpec = {
    name: '세대별',
    title: `${label} 세대별 수도요금${prev ? ` (지난 회차: ${monthsLabel(prev.m1)})` : ''}`,
    widths: [6, 6, 9, 10, 10, 10, 12, 10, 11, 9, 11, 10, 11, 12, 12],
    center: [0, 1, 2],
    header: ['순서', '동', '호수', '전월', '당월', '사용량(㎥)', '지난 회차(㎥)', '증감(㎥)', '사용요금', '누진', '수도요금', '공동전기', '고지액', '지난 고지액', '고지액 증감'],
    rows: hh,
  };

  // 3. 기금 장부 (앱 전체 장부)
  const L = buildLedger(data);
  const fund: SheetSpec = {
    name: '기금 장부',
    title: '공동기금 장부',
    widths: [13, 18, 30, 12, 12, 8],
    header: ['날짜', '구분', '내용', '금액(원)', '잔액(원)', '비고'],
    rows: [
      ...L.rows.map((x): SheetRow => ({
        cells: [x.date ? dotDate(x.date) : '', x.kind, x.note, x.amount, x.balance, x.pending ? '예정' : ''],
        fmts: [null, null, null, I, I, null],
      })),
      { cells: ['', '확정분 잔액', '', null, L.confirmed, ''], fmts: [null, null, null, null, I, null], bold: true },
      { cells: ['', '예정 포함 잔액', '', null, L.projected, ''], fmts: [null, null, null, null, I, null], bold: true },
    ],
  };

  return [buildStatementSheet(data, periodId), summary, households, fund];
}
