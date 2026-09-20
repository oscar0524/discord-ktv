import { useEffect, useRef, useState } from 'react';
import {
  emptyQueueState,
  KtvEventType,
  type QueueState,
  type ServerMessage,
} from '@discord-ktv/shared-types';
import { wsEndpoint } from './client';

/**
 * 訂閱 api 的 WebSocket，維護最新的 QueueState。
 * 只處理 QueueUpdated 訊息（api 已把所有變動收斂成完整狀態推播）。
 * 斷線時自動重連。
 */
export function useQueue(): { state: QueueState; connected: boolean } {
  const [state, setState] = useState<QueueState>(emptyQueueState);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;
          if (msg.type === KtvEventType.QueueUpdated) {
            setState(msg.payload as QueueState);
          }
        } catch {
          // 忽略無法解析的訊息
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { state, connected };
}
