/*
 * 만드는 데 시간이 걸리는 파일(PDF, 엑셀) 저장.
 * iOS는 버튼을 누른 직후에만 공유 시트를 열 수 있어서, 몇 초 걸려 파일을 만든 뒤 공유하면
 * 에어드롭 같은 대상이 실패한다. 그래서 공유 기기(아이폰)에서는 두 번에 나눈다:
 *   1) 누르면 파일을 만들어 둔다 → 버튼이 "공유하기"로 바뀜
 *   2) 다시 누르면 곧바로 공유 시트를 연다
 * 맥처럼 내려받는 기기는 한 번에 저장한다.
 */
import { useCallback, useEffect, useState } from 'react';
import { prefersShare, saveFile } from '../lib/device';
import { useToast } from './Toast';

export type Prepared = { blob: Blob; name: string };
export type FileStage = 'idle' | 'busy' | 'ready';

type Options = {
  /** 파일 만들기. 실패하면 throw */
  build: () => Promise<Prepared>;
  /** 이 값이 바뀌면(데이터·회차 변경) 만들어 둔 파일은 버린다 */
  key: unknown;
  /** 토스트에 쓰는 이름 (예: 'PDF', '엑셀 파일') */
  what: string;
};

export function usePreparedFile({ build, key, what }: Options) {
  const toast = useToast();
  const [stage, setStage] = useState<FileStage>('idle');
  const [ready, setReady] = useState<(Prepared & { key: unknown }) | null>(null);

  // 데이터가 바뀌면 만들어 둔 파일은 낡은 것
  useEffect(() => {
    setReady((r) => (r && r.key !== key ? null : r));
  }, [key]);
  useEffect(() => {
    if (!ready && stage === 'ready') setStage('idle');
  }, [ready, stage]);

  const deliver = useCallback(
    async (f: Prepared) => {
      // saveFile은 첫 await 전에 navigator.share를 부르므로, 누른 순간의 허용이 그대로 쓰인다
      const res = await saveFile(f.blob, f.name);
      if (res === 'shared') toast(`${what} 보내기 완료`);
      else if (res === 'downloaded') toast(`${f.name} 저장`);
      return res;
    },
    [toast, what],
  );

  const run = useCallback(async () => {
    if (stage === 'busy') return;
    // 만들어 둔 파일이 있으면 지금 누른 순간에 바로 공유 시트를 연다
    if (ready && ready.key === key) {
      try {
        // 공유 창을 닫기만 했으면 파일은 남겨 두고 다시 보낼 수 있게 한다
        if ((await deliver(ready)) !== 'cancelled') setReady(null);
      } catch (e) {
        console.error(e);
        toast(`${what} 보내기 실패. 다시 눌러 보세요.`);
      }
      return;
    }
    setStage('busy');
    try {
      const f = await build();
      if (prefersShare()) {
        setReady({ ...f, key });
        setStage('ready');
        toast(`${what} 준비 완료. 버튼을 한 번 더 누르면 공유 창이 열립니다.`);
      } else {
        await deliver(f);
        setStage('idle');
      }
    } catch (e) {
      console.error(e);
      toast(`${what} 만들기 실패. 다시 눌러 보세요.`);
      setStage('idle');
    }
  }, [stage, ready, key, build, deliver, toast, what]);

  return { run, stage, busy: stage === 'busy' };
}
