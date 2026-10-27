import { useCallback, useMemo } from 'react';
import { useData } from '../store';
import { usePreparedFile } from './usePreparedFile';

/** 엑셀 저장. 아이폰은 만든 뒤 한 번 더 눌러 공유 시트, 맥은 바로 내려받기. 검침 중인 회차도 저장할 수 있다. */
export function useXlsxExport(periodId: string) {
  const data = useData();

  const build = useCallback(async () => {
    const p = data.periods.find((x) => x.id === periodId);
    if (!p) throw new Error('회차를 찾을 수 없습니다');
    const [{ buildWorkbookSpec, xlsxFilename }, { writeWorkbook, XLSX_MIME }] = await Promise.all([import('../lib/xlsxData'), import('../lib/xlsx')]);
    const buf = await writeWorkbook(buildWorkbookSpec(data, periodId));
    return { blob: new Blob([buf], { type: XLSX_MIME }), name: xlsxFilename(p) };
  }, [data, periodId]);

  const key = useMemo(() => ({ data, periodId }), [data, periodId]);
  return usePreparedFile({ build, key, what: '엑셀 파일' });
}
