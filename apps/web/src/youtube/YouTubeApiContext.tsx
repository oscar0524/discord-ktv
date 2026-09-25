import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * 提供已就緒的 YouTube IFrame Player API（全域 `YT` 物件）給子元件。
 *
 * 取代 youtube-player 套件：由本 provider 負責動態注入官方 script
 * (`https://www.youtube.com/iframe_api`)、透過 `window.onYouTubeIframeAPIReady`
 * 回呼等待 API 就緒，並以 Context 對外提供 `YT | null`。
 * `null` 代表尚未載入完成——消費端（Player）應在 null 時避免 `new YT.Player`。
 */

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

// Context 值：就緒後為全域 YT 物件，未就緒為 null。
// 用 undefined 當「未包 Provider」的哨兵，讓 hook 能 throw。
const YouTubeApiContext = createContext<typeof YT | null | undefined>(
  undefined
);

/** 若 script 尚未存在於 DOM 則注入一次。 */
function ensureScriptInjected(): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${IFRAME_API_SRC}"]`
  );
  if (existing) return;
  const script = document.createElement('script');
  script.src = IFRAME_API_SRC;
  script.async = true;
  document.head.appendChild(script);
}

export function YouTubeApiProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<typeof YT | null>(() => {
    // 若 API 已被其他來源載入完成，直接視為就緒。
    if (typeof window !== 'undefined' && window.YT?.Player) {
      return window.YT;
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 已就緒就不必再處理。
    if (window.YT?.Player) {
      setApi(window.YT);
      return;
    }

    let cancelled = false;

    // 保留既有回呼（理論上 CSR 單一 provider 不會有），在其後串接自己的處理。
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (!cancelled && window.YT) {
        setApi(window.YT);
      }
    };

    ensureScriptInjected();

    return () => {
      cancelled = true;
      // 只在自己仍是當前回呼時還原，避免覆蓋他人的設定。
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = previous;
      }
    };
  }, []);

  return (
    <YouTubeApiContext.Provider value={api}>
      {children}
    </YouTubeApiContext.Provider>
  );
}

/**
 * 取得目前的 YouTube IFrame API。就緒前為 `null`，就緒後為全域 `YT` 物件。
 * 未包在 <YouTubeApiProvider> 內使用時 throw。
 */
export function useYouTubeApi(): typeof YT | null {
  const ctx = useContext(YouTubeApiContext);
  if (ctx === undefined) {
    throw new Error('useYouTubeApi 必須在 <YouTubeApiProvider> 內使用');
  }
  return ctx;
}
