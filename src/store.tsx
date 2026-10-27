/* 앱 데이터 상태. 바꿀 때마다 IndexedDB에 순서대로 저장한다. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repo } from './db/db';
import type { AppData } from './lib/schema';

type Phase = 'loading' | 'empty' | 'ready' | 'error';

type Store = {
  phase: Phase;
  data: AppData | null;
  error: string | null;
  /** 데이터를 바꾸고 저장한다. 함수는 새 객체를 돌려줘야 한다. */
  update: (fn: (d: AppData) => AppData) => void;
  /** 전체 교체 (백업 불러오기, 빈 상태로 시작) */
  replace: (d: AppData) => Promise<void>;
  clear: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    repo
      .load()
      .then((d) => {
        dataRef.current = d;
        setData(d);
        setPhase(d ? 'ready' : 'empty');
      })
      .catch((e: unknown) => {
        console.error(e);
        setError('이 브라우저의 저장소를 열 수 없습니다. 사파리 개인정보 보호 브라우징이 꺼져 있는지 확인하세요.');
        setPhase('error');
      });
  }, []);

  const persist = useCallback((d: AppData) => {
    queue.current = queue.current
      .then(() => repo.replaceAll(d))
      .catch((e: unknown) => {
        console.error(e);
        setError('저장하지 못했습니다. 저장 공간이 부족한지 확인하고, 백업 파일을 먼저 저장하세요.');
      });
    return queue.current;
  }, []);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      const cur = dataRef.current;
      if (!cur) return;
      const next = fn(cur);
      if (next === cur) return;
      dataRef.current = next;
      setData(next);
      void persist(next);
    },
    [persist],
  );

  const replace = useCallback(
    async (d: AppData) => {
      dataRef.current = d;
      setData(d);
      setError(null);
      setPhase('ready');
      await persist(d);
    },
    [persist],
  );

  const clear = useCallback(async () => {
    await queue.current;
    await repo.clearAll();
    dataRef.current = null;
    setData(null);
    setPhase('empty');
  }, []);

  const value = useMemo(() => ({ phase, data, error, update, replace, clear }), [phase, data, error, update, replace, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider 안에서만 쓸 수 있습니다');
  return s;
}

/** 데이터가 준비된 화면에서만 쓴다. */
export function useData(): AppData {
  const { data } = useStore();
  if (!data) throw new Error('데이터가 아직 없습니다');
  return data;
}
