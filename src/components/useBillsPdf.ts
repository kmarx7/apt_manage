import { useCallback, useMemo } from 'react';
import { billFilename, billInfo } from '../lib/bills';
import { today } from '../lib/format';
import { calcPeriod } from '../lib/period';
import { useData } from '../store';
import { useToast } from './Toast';
import { usePreparedFile } from './usePreparedFile';

/** 고지서 PDF 저장. 아이폰은 만든 뒤 한 번 더 눌러 공유 시트, 맥은 바로 내려받기. */
export function useBillsPdf(periodId: string) {
  const data = useData();
  const toast = useToast();
  const p = data.periods.find((x) => x.id === periodId);
  const ready = p ? calcPeriod(p, data).ready : false;

  const build = useCallback(async () => {
    if (!p) throw new Error('회차를 찾을 수 없습니다');
    toast('PDF를 만드는 중입니다…');
    const r = calcPeriod(p, data);
    const { buildBillsPdf } = await import('../lib/pdf');
    const blob = await buildBillsPdf({ p, rows: r.rows, info: billInfo(data.settings), issued: p.issued ?? today() });
    return { blob, name: billFilename(p) };
  }, [data, p, toast]);

  // 데이터나 회차가 바뀌면 만들어 둔 PDF는 버린다
  const key = useMemo(() => ({ data, periodId }), [data, periodId]);
  const file = usePreparedFile({ build, key, what: 'PDF' });

  const run = useCallback(async () => {
    if (!ready) {
      toast('검침과 고지서 입력을 마치면 PDF를 만들 수 있습니다.');
      return;
    }
    await file.run();
  }, [ready, file, toast]);

  return { ...file, run };
}
