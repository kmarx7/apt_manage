/* 엑셀 '정산표' 시트: 손으로 쓰던 정산 엑셀과 같은 모양(요약 칸 + 1동·2동 좌우 세대표 + 총계). 칸 위치와 값만 정하고, 파일 쓰기는 xlsx.ts가 한다. */
import { dotDate } from './format';
import { calcPeriod } from './period';
import type { Row } from './calc';
import type { AppData, Household, Method } from './schema';
import { NF, type Cell, type Fmt } from './xlsxData';

export type GridStyle = 'title' | 'note' | 'head' | 'id' | 'cell' | 'strong';
/** r, c는 1부터. span은 오른쪽으로 합칠 칸 수 */
export type GridCell = { r: number; c: number; v: Cell; fmt?: Fmt; style: GridStyle; span?: number };
/** tall: 머리칸 글이 두 줄로 접히도록 높게 둘 행 */
export type GridSpec = { kind: 'grid'; name: string; widths: number[]; cells: GridCell[]; tall: number[] };

const STATUS = { draft: '작성 중', done: '확정', closed: '마감' } as const;
const METHOD: Record<Method, string> = { avg: '평균 단가 (현행)', full: '누수 전액 배분', fullMinusN: '누진 수입 차감 후 전액 배분' };

export const TABLE_HEAD = ['순서', '호수', '전월', '당월', '사용량', '당월금액', '올림금액', '누진세', '금액', '공동전기', '납부금액'];
/** 2동 표가 시작하는 열 (1동 표 11칸 + 빈 칸 1) */
export const RIGHT = 13;
export const TABLE_ROW = 11;

const sumOf = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);

/** 엑셀처럼 1동은 아래층(지1호)부터 — 검침 순서의 반대. 2동은 검침 순서 그대로. */
export const statementOrder = <H extends Household>(rows: Row<H>[], dong: 1 | 2): Row<H>[] => {
  const xs = rows.filter((x) => x.dong === dong).sort((a, b) => a.seq - b.seq);
  return dong === 1 ? xs.reverse() : xs;
};

export function buildStatementSheet(data: AppData, periodId: string): GridSpec {
  const p = data.periods.find((x) => x.id === periodId);
  if (!p) throw new Error('회차를 찾을 수 없습니다');
  const r = calcPeriod(p, data);
  // xlsxData와 서로 불러오므로 NF는 모듈 최상단이 아니라 여기서 읽는다
  const I = NF.int;
  const cells: GridCell[] = [];
  const put = (row: number, c: number, v: Cell, style: GridStyle, fmt?: Fmt, span?: number) =>
    cells.push({ r: row, c, v, style, ...(fmt && typeof v === 'number' ? { fmt } : {}), ...(span ? { span } : {}) });
  const ok = <T,>(v: T) => (r.ready ? v : null);

  // 1행: 제목, 상태
  put(1, 1, `${p.year}년 ${p.m1}월 · ${p.m1 + 1}월 수도요금 정산표`, 'title', undefined, 11);
  put(1, RIGHT, `상태: ${STATUS[p.status]}   발행일: ${p.issued ? dotDate(p.issued) : '확정 전'}`, 'note', undefined, 11);

  // 3~4행, 6~7행: 요약 (B열부터)
  const block = (row: number, items: [string, Cell, Fmt | undefined, number?][]) => {
    let c = 2;
    for (const [label, v, fmt, span] of items) {
      put(row, c, label, 'head', undefined, span);
      put(row + 1, c, v, 'strong', fmt, span);
      c += span ?? 1;
    }
  };
  block(3, [
    ['고지서 금액', p.bill, I],
    ['고지서 사용량', p.billQty, I],
    ['계량기 합계', r.metered, I],
    ['누수량', ok(r.leak), I],
    ['누수율', ok(r.leakRate), NF.pct],
    ['고지서 단가', r.unitBill, NF.price],
    ['계량 단가', r.unitMeter, NF.price],
    ['기준 단가', r.base, NF.price],
    ['추가조정', Number(p.adj) || 0, I],
    ['적용 단가', r.P, NF.price],
  ]);
  block(6, [
    ['사용요금 합계', ok(r.useTotal), I],
    ['누진세 합계', ok(r.surTotal), I],
    ['수도요금 합계', ok(r.waterTotal), I],
    ['공동전기 합계', ok(r.elecTotal), I],
    ['납부금액 합계', ok(r.waterTotal + r.elecTotal), I],
    ['수도 정산 차액', r.diff, NF.neg],
    ['손익 0 조정값', r.breakEven, I],
    ['단가 방식', METHOD[p.method], undefined, 3],
  ]);

  // 9행부터: 1동(왼쪽), 2동(오른쪽) 세대표
  const raw = (x: Row<Household>) => (x.u != null && r.P != null ? x.u * r.P : null);
  const table = (dong: 1 | 2, c0: number): number => {
    const rows = statementOrder(r.rows, dong);
    put(TABLE_ROW - 2, c0, `${dong}동`, 'strong', undefined, 2);
    TABLE_HEAD.forEach((h, i) => put(TABLE_ROW - 1, c0 + i, h, 'head'));
    rows.forEach((x, i) => {
      const vals: Cell[] = [i + 1, x.id, x.prev ?? null, x.curr, x.u, raw(x), x.use, x.sur, x.water, x.elec, x.total];
      vals.forEach((v, j) => put(TABLE_ROW + i, c0 + j, v, j === 1 ? 'id' : j === 10 ? 'strong' : 'cell', j === 0 ? undefined : I));
    });
    const sumRow = TABLE_ROW + rows.length;
    const sums: Cell[] = [
      '합계', `${rows.length}세대`, null, null,
      sumOf(rows.map((x) => x.u)),
      ok(sumOf(rows.map(raw))), ok(sumOf(rows.map((x) => x.use))), ok(sumOf(rows.map((x) => x.sur))),
      ok(sumOf(rows.map((x) => x.water))), ok(sumOf(rows.map((x) => x.elec))), ok(sumOf(rows.map((x) => x.total))),
    ];
    sums.forEach((v, j) => put(sumRow, c0 + j, v, j < 2 ? 'head' : 'strong', I));
    return sumRow;
  };
  const last = Math.max(table(1, 1), table(2, RIGHT));

  // 총계와 차액 (1동 표 아래)
  const t = last + 2;
  const totals: Cell[] = [
    '총계', `${r.rows.length}세대`, null, null, r.metered,
    ok(sumOf(r.rows.map(raw))), ok(r.useTotal), ok(r.surTotal), ok(r.waterTotal), ok(r.elecTotal), ok(r.waterTotal + r.elecTotal),
  ];
  totals.forEach((v, j) => put(t, 1 + j, v, j < 2 ? 'head' : 'strong', I));
  put(t + 2, 8, '수도요금 합계', 'head', undefined, 3);
  put(t + 2, 11, ok(r.waterTotal), 'strong', I);
  put(t + 3, 8, '고지서 금액', 'head', undefined, 3);
  put(t + 3, 11, p.bill, 'strong', I);
  put(t + 4, 8, '차액 (수도요금 − 고지서)', 'head', undefined, 3);
  put(t + 4, 11, r.diff, 'strong', NF.neg);

  const widths = [6, 9, 9, 9, 8, 11, 11, 9, 11, 9, 12];
  return { kind: 'grid', name: '정산표', widths: [...widths, 2, ...widths], cells, tall: [3, 6] };
}
