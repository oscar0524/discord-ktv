import { renderHook, act } from '@testing-library/react';
import { KtvEventType } from '@discord-ktv/shared-types';
import { useDanmakuFeed, type DanmakuItem } from './useDanmakuFeed';

/** 可控制的 fake WebSocket，測試中可手動觸發 onmessage */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = jest.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('useDanmakuFeed', () => {
  let originalWS: typeof WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    originalWS = global.WebSocket;
    (global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    (global as unknown as { WebSocket: unknown }).WebSocket = originalWS;
  });

  it('收到 Danmaku 訊息時回傳帶正確 text 的 item 並呼叫 callback', () => {
    const received: DanmakuItem[] = [];
    const { result } = renderHook(() =>
      useDanmakuFeed((item) => received.push(item))
    );

    const ws = FakeWebSocket.instances[0];
    act(() => {
      ws.emit({
        type: KtvEventType.Danmaku,
        payload: { text: 'oscar：安安' },
      });
    });

    expect(result.current.latest?.text).toBe('oscar：安安');
    expect(result.current.latest?.id).toBeTruthy();
    expect(received).toHaveLength(1);
    expect(received[0].text).toBe('oscar：安安');
  });

  it('每則彈幕的 id 皆唯一', () => {
    const { result } = renderHook(() => useDanmakuFeed());
    const ws = FakeWebSocket.instances[0];

    act(() => ws.emit({ type: KtvEventType.Danmaku, payload: { text: 'a' } }));
    const first = result.current.latest?.id;
    act(() => ws.emit({ type: KtvEventType.Danmaku, payload: { text: 'b' } }));
    const second = result.current.latest?.id;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('忽略非 Danmaku 訊息', () => {
    const received: DanmakuItem[] = [];
    const { result } = renderHook(() =>
      useDanmakuFeed((item) => received.push(item))
    );
    const ws = FakeWebSocket.instances[0];

    act(() => {
      ws.emit({
        type: KtvEventType.QueueUpdated,
        payload: { items: [], current: null, isPaused: false },
      });
    });

    expect(result.current.latest).toBeNull();
    expect(received).toHaveLength(0);
  });

  it('忽略空字串彈幕', () => {
    const { result } = renderHook(() => useDanmakuFeed());
    const ws = FakeWebSocket.instances[0];

    act(() => ws.emit({ type: KtvEventType.Danmaku, payload: { text: '' } }));

    expect(result.current.latest).toBeNull();
  });
});
