/* 고지서 A4 — 엑셀 고지서와 같은 표 형식(8열, 모든 칸에 선). 벌금란은 없다. 종이는 항상 흰 바탕. */
import { pairUp, type BillInfo } from '../lib/bills';
import { korDate, won } from '../lib/format';
import type { Period } from '../lib/schema';

export type BillRow = {
  id: string;
  prev: number | undefined;
  curr: number | null;
  u: number | null;
  water: number | null;
  elec: number;
  total: number | null;
};

const COLS = Array.from({ length: 8 });

function Slip({ p, x, info, issued }: { p: Period; x: BillRow | null; info: BillInfo; issued: string }) {
  if (!x) return <div className="slip empty" aria-hidden="true" />;
  return (
    <div className="slip">
      <table className="form">
        <colgroup>
          {COLS.map((_, i) => (
            <col key={i} style={{ width: '12.5%' }} />
          ))}
        </colgroup>
        <tbody>
          <tr className="blank">
            <td colSpan={8} />
          </tr>
          <tr>
            <td colSpan={2}>{p.year}</td>
            <td>{p.m1}월</td>
            <td>{p.m1 + 1}월</td>
            <td colSpan={4} className="mid">
              수도요금 입금계좌: {info.holder}
            </td>
          </tr>
          <tr>
            <td className="left" />
            <td colSpan={2} className="unit left right">
              {x.id}
            </td>
            <td className="right" />
            <td colSpan={4} className="mid">
              {info.bankLine}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="sp">
              수도요금
            </td>
            <td colSpan={2}>{won(x.water)}</td>
            <td colSpan={4} className="mid sp">
              영수증
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="sp">
              공동전기
            </td>
            <td colSpan={2}>{won(x.elec)}</td>
            <td className="mid sp">일금</td>
            <td colSpan={2} className="big">
              {won(x.total)}
            </td>
            <td>원정</td>
          </tr>
          <tr>
            <td colSpan={2}>계</td>
            <td colSpan={2}>{won(x.total)}</td>
            <td colSpan={4} className="mid">
              위 금액을 정히 영수하였습니다.
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="sp">
              사용량
            </td>
            <td colSpan={4} className="mid">
              {korDate(issued)}
            </td>
          </tr>
          <tr>
            <td style={{ fontSize: '10pt' }}>내역/구분</td>
            <td className="sp">전월</td>
            <td className="sp">금월</td>
            <td>사용량</td>
            <td colSpan={4} rowSpan={2} className="mid co">
              {info.company}
            </td>
          </tr>
          <tr>
            <td className="sp">수도</td>
            <td>{won(x.prev)}</td>
            <td>{won(x.curr)}</td>
            <td>{won(x.u)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type Props = { p: Period; rows: BillRow[]; info: BillInfo; issued: string };

/** A4 한 장씩. 미리보기·인쇄·PDF가 모두 이 마크업을 쓴다. */
export function BillSheets({ p, rows, info, issued }: Props) {
  return (
    <>
      {pairUp(rows).map(([a, b]) => (
        <div className="sheet-wrap" key={a.id}>
          <div className="sheet">
            <Slip p={p} x={a} info={info} issued={issued} />
            <Slip p={p} x={b} info={info} issued={issued} />
          </div>
        </div>
      ))}
    </>
  );
}
