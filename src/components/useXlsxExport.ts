import { useCallback, useState } from 'react';
import { saveFile } from '../lib/device';
import { useData } from '../store';
import { useToast } from './Toast';

/** 엑셀 저장. 아이폰은 공유 시트, 맥은 내려받기. 검침 중인 회차도 저장할 수 있다(빈칸은 비워 둠). */
export function useXlsxExport(periodId: string) {
  const data = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    const p = data.periods.find((x) => x.id === periodId);
    if (!p || busy) return;
    setBusy(true);
    try {
      const [{ buildWorkbookSpec, xlsxFilename }, { writeWorkbook, XLSX_MIME }] = await Promise.all([import('../lib/xlsxData'), import('../lib/xlsx')]);
      const buf = await writeWorkbook(buildWorkbookSpec(data, periodId));
      const name = xlsxFilename(p);
      const res = await saveFile(new Blob([buf], { type: XLSX_MIME }), name);
      if (res !== 'cancelled') toast(res === 'shared' ? '엑셀 파일을 보냈습니다.' : `${name} 저장`);
    } catch (e) {
      console.error(e);
      toast('엑셀 파일을 만들지 못했습니다. 다시 눌러 보세요.');
    } finally {
      setBusy(false);
    }
  }, [data, periodId, busy, toast]);

  return { run, busy };
}
