/* 기기 기능: 파일 공유/저장, 저장소 지속성, 홈 화면 실행 여부. 외부 요청은 하지 않는다. */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

const canShareFile = (file: File) => {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

/** 터치 기기(아이폰)에서는 공유 시트(에어드롭 등), 그 밖에는 내려받기. */
export const prefersShare = () =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveFile(blob: Blob, filename: string, opts: { share?: boolean } = {}): Promise<SaveResult> {
  const file = new File([blob], filename, { type: blob.type });
  const share = opts.share ?? prefersShare();
  if (share && canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 공유가 막히면 내려받기로 넘어간다
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export type PersistState = 'granted' | 'denied' | 'unsupported';

export async function requestPersist(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** 홈 화면에 추가해서 실행했는지 */
export const isStandalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
