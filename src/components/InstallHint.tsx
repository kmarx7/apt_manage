import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/device';

/** iOS 사파리는 홈 화면에 추가하지 않은 사이트의 저장소를 지울 수 있다. 브라우저로 열었을 때만 안내한다. */
export function InstallHint() {
  const [closed, setClosed] = useState(false);
  if (closed || isStandalone() || !isIOS()) return null;
  return (
    <div className="install-hint no-print">
      <div className="wrap">
        <span>
          사파리 아래쪽 공유 버튼 → <b>홈 화면에 추가</b>로 설치해서 쓰세요. 그냥 사이트로 쓰면 오래 열지 않을 때 저장한 데이터가 지워질 수 있습니다.
        </span>
        <button className="btn small" onClick={() => setClosed(true)}>
          닫기
        </button>
      </div>
    </div>
  );
}
