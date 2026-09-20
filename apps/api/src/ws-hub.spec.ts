import type { WebSocket } from 'ws';
import { KtvEventType, emptyQueueState } from '@discord-ktv/shared-types';
import { WebSocketHub } from './ws-hub';

/** 建立一個假的 WebSocket，記錄 send 呼叫 */
function fakeSocket(readyState = 1) {
  const sent: string[] = [];
  const listeners: Record<string, () => void> = {};
  const socket = {
    readyState,
    send: (data: string) => sent.push(data),
    on: (event: string, cb: () => void) => {
      listeners[event] = cb;
    },
    close: () => listeners['close']?.(),
  };
  return { socket: socket as unknown as WebSocket, sent, triggerClose: () => socket.close() };
}

describe('WebSocketHub', () => {
  it('broadcast 送給所有 OPEN 連線', () => {
    const hub = new WebSocketHub();
    const a = fakeSocket(1);
    const b = fakeSocket(1);
    hub.add(a.socket);
    hub.add(b.socket);

    hub.broadcast({ type: KtvEventType.QueueUpdated, payload: emptyQueueState() });

    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    expect(JSON.parse(a.sent[0]).type).toBe(KtvEventType.QueueUpdated);
  });

  it('略過非 OPEN 的連線', () => {
    const hub = new WebSocketHub();
    const closed = fakeSocket(3); // CLOSED
    hub.add(closed.socket);
    hub.broadcast({ type: KtvEventType.Pause, payload: {} });
    expect(closed.sent).toHaveLength(0);
  });

  it('連線關閉後自動移除', () => {
    const hub = new WebSocketHub();
    const a = fakeSocket(1);
    hub.add(a.socket);
    expect(hub.size).toBe(1);
    a.triggerClose();
    expect(hub.size).toBe(0);
  });
});
