import { render, screen, fireEvent, act } from '@testing-library/react';
import { DanmakuProvider, useDanmaku } from '../danmaku/DanmakuContext';
import { DanmakuOverlay } from './DanmakuOverlay';
import type { DanmakuItem } from '../api/useDanmakuFeed';

/**
 * 假 feed：把消費端的 onDanmaku 存起來，讓測試手動推送彈幕。
 * 回傳形狀比照 useDanmakuFeed（{ latest }），此處測試不需 latest。
 */
function makeFakeFeed() {
  let cb: ((item: DanmakuItem) => void) | undefined;
  const feed = (onDanmaku?: (item: DanmakuItem) => void) => {
    cb = onDanmaku;
    return { latest: null };
  };
  const push = (item: DanmakuItem) => {
    act(() => cb?.(item));
  };
  return { feed, push };
}

/** 提供切換 enabled 的按鈕，測試開關行為 */
function ToggleButton() {
  const { toggle } = useDanmaku();
  return (
    <button data-testid="toggle" onClick={toggle}>
      toggle
    </button>
  );
}

describe('DanmakuOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('注入 item 後 render 出對應文字', () => {
    const { feed, push } = makeFakeFeed();
    render(
      <DanmakuProvider>
        <DanmakuOverlay feed={feed} />
      </DanmakuProvider>
    );

    push({ id: 'd1', text: 'oscar：安安' });

    expect(screen.getByText('oscar：安安')).toBeInTheDocument();
    expect(screen.getAllByTestId('danmaku-item')).toHaveLength(1);
  });

  it('animationEnd 後移除該彈幕', () => {
    const { feed, push } = makeFakeFeed();
    render(
      <DanmakuProvider>
        <DanmakuOverlay feed={feed} />
      </DanmakuProvider>
    );

    push({ id: 'd1', text: '飄過去' });
    const item = screen.getByTestId('danmaku-item');
    fireEvent.animationEnd(item);

    expect(screen.queryByText('飄過去')).not.toBeInTheDocument();
  });

  it('enabled=false 時不 render 彈幕層', () => {
    window.localStorage.setItem('ktv-danmaku-enabled', 'false');
    const { feed, push } = makeFakeFeed();
    render(
      <DanmakuProvider>
        <DanmakuOverlay feed={feed} />
      </DanmakuProvider>
    );

    push({ id: 'd1', text: '不該出現' });

    expect(screen.queryByTestId('danmaku-overlay')).not.toBeInTheDocument();
    expect(screen.queryByText('不該出現')).not.toBeInTheDocument();
  });

  it('關閉開關後清空現有彈幕', () => {
    const { feed, push } = makeFakeFeed();
    render(
      <DanmakuProvider>
        <DanmakuOverlay feed={feed} />
        <ToggleButton />
      </DanmakuProvider>
    );

    push({ id: 'd1', text: '先出現' });
    expect(screen.getByText('先出現')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle'));

    expect(screen.queryByTestId('danmaku-overlay')).not.toBeInTheDocument();
    expect(screen.queryByText('先出現')).not.toBeInTheDocument();
  });
});
