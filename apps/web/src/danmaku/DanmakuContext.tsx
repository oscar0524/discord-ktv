import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * 彈幕顯示開關的 Context（比照 ThemeContext）。
 * 狀態持久化於 localStorage，預設啟用。SSR-safe（無 window 時回預設）。
 */

const STORAGE_KEY = 'ktv-danmaku-enabled';

interface DanmakuContextValue {
  /** 是否顯示彈幕 */
  enabled: boolean;
  /** 切換開關 */
  toggle: () => void;
  /** 直接設定開關 */
  setEnabled: (enabled: boolean) => void;
}

const DanmakuContext = createContext<DanmakuContextValue | undefined>(undefined);

/** 取得初始開關：localStorage > 預設 true */
function resolveInitialEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return true;
}

export function DanmakuProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(resolveInitialEnabled);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    }
  }, [enabled]);

  const setEnabled = useCallback(
    (next: boolean) => setEnabledState(next),
    []
  );
  const toggle = useCallback(() => setEnabledState((v) => !v), []);

  const value = useMemo<DanmakuContextValue>(
    () => ({ enabled, toggle, setEnabled }),
    [enabled, toggle, setEnabled]
  );

  return (
    <DanmakuContext.Provider value={value}>{children}</DanmakuContext.Provider>
  );
}

export function useDanmaku(): DanmakuContextValue {
  const ctx = useContext(DanmakuContext);
  if (!ctx) {
    throw new Error('useDanmaku 必須在 <DanmakuProvider> 內使用');
  }
  return ctx;
}
