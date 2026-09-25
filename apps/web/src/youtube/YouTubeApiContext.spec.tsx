import { act, render, renderHook, screen } from '@testing-library/react';
import { YouTubeApiProvider, useYouTubeApi } from './YouTubeApiContext';

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

/** 探針元件：顯示目前 API 是否就緒。 */
function Probe() {
  const api = useYouTubeApi();
  return <div data-testid="probe">{api ? 'ready' : 'null'}</div>;
}

describe('YouTubeApiProvider / useYouTubeApi', () => {
  afterEach(() => {
    // 清掉注入的 script 與全域狀態，避免測試互相污染。
    document
      .querySelectorAll(`script[src="${IFRAME_API_SRC}"]`)
      .forEach((el) => el.remove());
    delete (window as { YT?: unknown }).YT;
    delete (window as { onYouTubeIframeAPIReady?: unknown })
      .onYouTubeIframeAPIReady;
  });

  it('掛載時注入 iframe_api script，且 context 初始為 null', () => {
    render(
      <YouTubeApiProvider>
        <Probe />
      </YouTubeApiProvider>
    );

    const script = document.querySelector(`script[src="${IFRAME_API_SRC}"]`);
    expect(script).not.toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent('null');
  });

  it('觸發 onYouTubeIframeAPIReady 後，useYouTubeApi 變為就緒的 YT', () => {
    const fakeYT = { Player: function () {}, PlayerState: { ENDED: 0 } };

    render(
      <YouTubeApiProvider>
        <Probe />
      </YouTubeApiProvider>
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('null');

    act(() => {
      (window as unknown as { YT: typeof fakeYT }).YT = fakeYT;
      window.onYouTubeIframeAPIReady?.();
    });

    expect(screen.getByTestId('probe')).toHaveTextContent('ready');
  });

  it('window.YT 已就緒時，掛載即為就緒狀態', () => {
    (window as unknown as { YT: unknown }).YT = {
      Player: function () {},
      PlayerState: { ENDED: 0 },
    };

    render(
      <YouTubeApiProvider>
        <Probe />
      </YouTubeApiProvider>
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('ready');
  });

  it('未包 Provider 時使用 hook 會 throw', () => {
    // 抑制 React 對 render 期間 throw 的錯誤輸出。
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useYouTubeApi())).toThrow(
      'useYouTubeApi 必須在 <YouTubeApiProvider> 內使用'
    );
    spy.mockRestore();
  });
});
