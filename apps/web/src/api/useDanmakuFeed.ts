import { useEffect, useRef, useState } from 'react';
import {
  KtvEventType,
  type DanmakuPayload,
  type ServerMessage,
} from '@discord-ktv/shared-types';
import { wsEndpoint } from './client';

/** 前端內部使用的一則彈幕項目（帶唯一 id 供 render / 動畫用） */
export interface DanmakuItem {
  /** 前端配發的唯一 id */
  id: string;
  /** 顯示文字（後端已格式化好的「暱稱：訊息」） */
  text: string;
}

let danmakuSeq = 0;
function nextDanmakuId(): string {
  danmakuSeq += 1;
  return `danmaku_${Date.now()}_${danmakuSeq}`;
}

/**
 * 訂閱 api 的 WebSocket，只處理 Danmaku 訊息。
 * 每收到一則就產生一個帶唯一 id 的 DanmakuItem，透過回傳的 `latest`
 * 通知消費端（每則都是新物件參考，方便 useEffect 依賴偵測），
 * 同時呼叫可選的 onDanmaku callback。
 * 斷線自動重連（比照 useQueue）。
 */
export function useDanmakuFeed(
  onDanmaku?: (item: DanmakuItem) => void
): { latest: DanmakuItem | null } {
  const [latest, setLatest] = useState<DanmakuItem | null>(null);
  // 用 ref 保存最新 callback，避免把它放進 effect 依賴而反覆重連
  const callbackRef = useRef(onDanmaku);
  callbackRef.current = onDanmaku;
  // 保存目前這條連線，讓 cleanup 能確實關閉，避免重複訂閱
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      ws.onclose = () => {
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;
          if (msg.type !== KtvEventType.Danmaku) return;
          const { text } = msg.payload as DanmakuPayload;
          if (typeof text !== 'string' || text.length === 0) return;
          const item: DanmakuItem = { id: nextDanmakuId(), text };
          setLatest(item);
          callbackRef.current?.(item);
        } catch {
          // 忽略無法解析的訊息
        }
      };
    };

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      // 確實關閉連線，避免 StrictMode 雙重掛載 / 重新掛載時殘留舊訂閱
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { latest };
}
