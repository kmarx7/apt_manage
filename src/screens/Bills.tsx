/* 고지서 미리보기. 용지를 화면 폭에 맞춰 줄여 보여 주고, PDF 저장과 바로 인쇄를 둔다. */
import { useLayoutEffect, useRef } from 'react';
import { BillSheets } from '../components/BillSheets';
import { useBillsPdf } from '../components/useBillsPdf';
import { billInfo } from '../lib/bills';
import { today } from '../lib/format';
import { calcPeriod, periodLabel } from '../lib/period';
import { useData } from '../store';

const A4_W = 793.7; // 210mm @96dpi
const A4_H = 1122.5;

function useFitSheets(dep: unknown) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      el.querySelectorAll<HTMLElement>('.sheet-wrap').forEach((w) => {
        const sc = Math.min(1, w.clientWidth / A4_W);
        (w.firstElementChild as HTMLElement).style.transform = `scale(${sc})`;
        w.style.height = `${A4_H * sc}px`;
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dep]);
  return box;
}

export function Bills({ periodId, onSettings }: { periodId: string; onSettings: () => void }) {
  const data = useData();
  const p = data.periods.find((x) => x.id === periodId);
  const pdf = useBillsPdf(periodId);
  const r = p ? calcPeriod(p, data) : null;
  const box = useFitSheets(`${periodId}:${r?.ready}:${r?.rows.length}`);
  if (!p || !r) return null;

  if (!r.ready) {
    return (
      <section className="card">
        <div className="hd">
          <h2>고지서</h2>
        </div>
        <div className="bd">
          <p className="note warn" style={{ margin: 0 }}>
            검침과 고지서 입력을 마치면 고지서가 만들어집니다.
          </p>
        </div>
      </section>
    );
  }

  const info = billInfo(data.settings);
  const issued = p.issued ?? today();
  const pages = Math.ceil(r.rows.length / 2);

  return (
    <>
      <section className="card no-print">
        <div className="hd">
          <h2>
            {periodLabel(p)} 고지서 · A4 {pages}장
          </h2>
          <button className="btn primary" disabled={pdf.busy} onClick={() => void pdf.run()}>
            {pdf.busy ? 'PDF 만드는 중…' : pdf.stage === 'ready' ? 'PDF 공유하기' : 'PDF로 저장'}
          </button>
          <button className="btn" onClick={() => window.print()}>
            바로 인쇄
          </button>
        </div>
        <p className="lead">
          엑셀 고지서와 같은 양식으로, A4 한 장에 2세대씩 검침 순서대로 놓입니다. 가운데 점선을 따라 자릅니다.
          {p.status === 'draft' ? ' 확정 전이라 발행일은 오늘 날짜로 보입니다.' : ''}
        </p>
        {info.missing.length > 0 && (
          <div className="bd">
            <p className="note warn" style={{ margin: 0 }}>
              설정에 {info.missing.join(', ')}이(가) 비어 있어 고지서에 빈칸으로 나옵니다.{' '}
              <button className="btn small" onClick={onSettings}>
                설정 열기
              </button>
            </p>
          </div>
        )}
      </section>
      <div className="sheets" ref={box}>
        <BillSheets p={p} rows={r.rows} info={info} issued={issued} />
      </div>
    </>
  );
}
