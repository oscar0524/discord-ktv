import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './theme/ThemeContext';
import { YouTubeApiProvider } from './youtube/YouTubeApiContext';
import { DanmakuProvider } from './danmaku/DanmakuContext';
import App from './App';
import './styles.scss';

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 掛載點');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <YouTubeApiProvider>
        <DanmakuProvider>
          <App />
        </DanmakuProvider>
      </YouTubeApiProvider>
    </ThemeProvider>
  </StrictMode>,
);
