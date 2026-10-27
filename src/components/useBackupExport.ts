import { useCallback } from 'react';
import { backupBlob, backupFilename, isoLocal, makeBackup } from '../lib/backup';
import { saveFile } from '../lib/device';
import { useStore } from '../store';
import { useToast } from './Toast';

/** 백업 파일 저장. 아이폰은 공유 시트(에어드롭), 맥은 내려받기. 저장하면 마지막 백업 시각을 남긴다. */
export function useBackupExport() {
  const { data, update } = useStore();
  const toast = useToast();
  return useCallback(async () => {
    if (!data) return;
    const now = new Date();
    try {
      const res = await saveFile(backupBlob(makeBackup(data, now)), backupFilename(now));
      if (res === 'cancelled') return;
      update((d) => ({ ...d, settings: { ...d.settings, lastBackupAt: isoLocal(now) } }));
      toast(res === 'shared' ? '백업 파일을 보냈습니다.' : '백업 파일을 저장했습니다.');
    } catch (e) {
      console.error(e);
      toast('백업 파일을 만들지 못했습니다.');
    }
  }, [data, update, toast]);
}
