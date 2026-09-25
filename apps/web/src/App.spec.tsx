import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from './theme/ThemeContext';
import { YouTubeApiProvider } from './youtube/YouTubeApiContext';
import { DanmakuProvider } from './danmaku/DanmakuContext';
import App from './App';

/** 最小 fake WebSocket，讓 useQueue / useDanmakuFeed 不會真的連線 */
class FakeWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = jest.fn();
  constructor(public url: string) {}
}

function renderApp() {
  return render(
    <ThemeProvider>
      <YouTubeApiProvider>
        <DanmakuProvider>
          <App />
        </DanmakuProvider>
      </YouTubeApiProvider>
    </ThemeProvider>
  );
}

describe('App 彈幕開關整合', () => {
  let originalWS: typeof WebSocket;

  beforeEach(() => {
    window.localStorage.clear();
    originalWS = global.WebSocket;
    (global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    (global as unknown as { WebSocket: unknown }).WebSocket = originalWS;
  });

  it('側邊欄有彈幕開關，預設 overlay 顯示', () => {
    renderApp();
    expect(screen.getByTestId('btn-toggle-danmaku')).toBeInTheDocument();
    expect(screen.getByTestId('danmaku-overlay')).toBeInTheDocument();
  });

  it('點擊開關可切換：關閉後 overlay 隱藏、再開又出現', () => {
    renderApp();
    const btn = screen.getByTestId('btn-toggle-danmaku');

    fireEvent.click(btn);
    expect(screen.queryByTestId('danmaku-overlay')).not.toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.getByTestId('danmaku-overlay')).toBeInTheDocument();
  });

  it('開關狀態寫入 localStorage', () => {
    renderApp();
    fireEvent.click(screen.getByTestId('btn-toggle-danmaku'));
    expect(window.localStorage.getItem('ktv-danmaku-enabled')).toBe('false');
  });
});
