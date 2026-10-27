import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { reloadForNewVersion } from './lib/staleChunk';
import { StoreProvider } from './store';
import './styles/base.css';
import './styles/app.css';

// 새 배포 뒤 예전 화면이 사라진 조각 파일을 불러오려다 실패하면, 한 번 새로고침해 새 버전을 받는다
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
