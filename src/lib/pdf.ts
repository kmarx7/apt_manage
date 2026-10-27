/* 고지서 PDF: 화면 밖에 A4를 실제 크기로 그려 한 장씩 이미지로 떠서 jsPDF에 넣는다.
 * html2canvas·jspdf는 PDF를 만들 때만 불러온다 (첫 화면을 가볍게, 오프라인 캐시에는 포함). */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { BillSheets } from '../components/BillSheets';

type SheetsProps = Parameters<typeof BillSheets>[0];

export async function buildBillsPdf(props: SheetsProps, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const stage = document.createElement('div');
  stage.className = 'pdf-stage';
  stage.setAttribute('aria-hidden', 'true');
  document.body.appendChild(stage);
  const root = createRoot(stage);
  try {
    flushSync(() => root.render(createElement(BillSheets, props)));
    await document.fonts?.ready;

    const sheets = [...stage.querySelectorAll<HTMLElement>('.sheet')];
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    for (let k = 0; k < sheets.length; k++) {
      const canvas = await html2canvas(sheets[k], { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: false });
      if (k) doc.addPage();
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      // iOS 사파리는 캔버스 메모리 합계에 한도가 있어, 다 쓴 캔버스를 바로 0으로 줄여 돌려준다
      canvas.width = 0;
      canvas.height = 0;
      onProgress?.(k + 1, sheets.length);
      // 한 장마다 브라우저에 숨 돌릴 틈을 줘 메모리 정리와 화면 갱신이 되게 한다
      await new Promise((ok) => setTimeout(ok, 0));
    }
    return doc.output('blob');
  } finally {
    root.unmount();
    stage.remove();
  }
}
