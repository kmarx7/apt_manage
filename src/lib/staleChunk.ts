/*
 * 새 버전이 배포되면 예전 화면이 불러오려는 예전 조각 파일(PDF·엑셀 도구)이 사라질 수 있다.
 * 그때는 한 번 새로고침해 새 버전을 받는다. 같은 세션에서 반복해서 새로고침하지는 않는다.
 */

const KEY = 'stale-chunk-reload-at';
const MIN_GAP_MS = 60_000;

/** 동적 import 실패 메시지 (크롬·사파리·파이어폭스) */
export const isStaleChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(
    e instanceof Error ? e.message : String(e),
  );

/** 새로고침했으면 true. 방금 한 번 했으면 false (반복 방지) */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 저장소를 못 쓰면 반복 방지 없이 한 번만 시도
  }
  window.location.reload();
  return true;
}

/** 오류를 토스트에 붙일 짧은 이유로 */
export const shortReason = (e: unknown) => {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return msg.length > 80 ? `${msg.slice(0, 77)}…` : msg;
};
