import { useCallback, useState } from 'react';
import { billFilename, billInfo } from '../lib/bills';
import { saveFile } from '../lib/device';
import { today } from '../lib/format';
import { calcPeriod } from '../lib/period';
import { useData } from '../store';
import { useToast } from './Toast';

/** 고지서 PDF 저장. 아이폰은 공유 시트, 맥은 내려받기. */
export function useBillsPdf(periodId: string) {
  const data = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    const p = data.periods.find((x) => x.id === periodId);
    if (!p || busy) return;
    const r = calcPeriod(p, data);
    if (!r.ready) {
      toast('검침과 고지서 입력을 마치면 PDF를 만들 수 있습니다.');
      return;
    }
    setBusy(true);
    toast('PDF를 만드는 중입니다…');
    try {
      const { buildBillsPdf } = await import('../lib/pdf');
      const blob = await buildBillsPdf({ p, rows: r.rows, info: billInfo(data.settings), issued: p.issued ?? today() });
      const res = await saveFile(blob, billFilename(p));
      if (res !== 'cancelled') toast(res === 'shared' ? 'PDF를 보냈습니다.' : `${billFilename(p)} 저장`);
    } catch (e) {
      console.error(e);
      toast('PDF를 만들지 못했습니다. 다시 눌러 보세요.');
    } finally {
      setBusy(false);
    }
  }, [data, periodId, busy, toast]);

  return { run, busy };
}
