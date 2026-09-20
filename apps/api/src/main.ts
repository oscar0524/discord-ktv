import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import {
  KtvEventType,
  type KtvEvent,
  type ServerMessage,
} from '@discord-ktv/shared-types';
import {
  createRedis,
  KtvStore,
  publishEvent,
  subscribeEvent,
} from '@discord-ktv/redis-client';
import { createApp } from './app';
import { WebSocketHub } from './ws-hub';

/**
 * API 進入點：Express REST + WebSocket + Redis 訂閱。
 *
 * 資料流：
 * 1. 控制端點（skip/pause/play/ended）與 bot 都只「publish 事件」到 Redis。
 * 2. 本服務用獨立連線 subscribe 事件，統一在此更新佇列狀態，
 *    再把最新 QueueState 透過 WebSocket 廣播給所有前端（大螢幕）。
 * 這樣佇列的變動邏輯只有一處，避免多寫入者競態。
 */
async function main(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 3333);

  // 命令連線（讀寫佇列、publish）
  const redis = createRedis();
  // 訂閱連線（進入 subscribe 模式後不可再下一般命令，需獨立）
  const subRedis = createRedis();
  const store = new KtvStore(redis);
  const hub = new WebSocketHub();

  // all-in-one image 會把 web 產物放在此目錄；存在才啟用 static
  const webStaticDir = path.resolve(__dirname, '../web');
  const serveStatic = fs.existsSync(webStaticDir);

  const app = createApp({
    store,
    publish: (event: KtvEvent) => publishEvent(redis, event),
    webStaticDir: serveStatic ? webStaticDir : undefined,
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  hub.attach(wss);

  // 新連線先推一次目前狀態，讓前端立即同步
  wss.on('connection', async (socket) => {
    const state = await store.getState();
    const msg: ServerMessage = {
      type: KtvEventType.QueueUpdated,
      payload: state,
    };
    socket.send(JSON.stringify(msg));
  });

  // 訂閱 Redis 事件：更新佇列狀態並廣播
  subscribeEvent(subRedis, (event) => {
    void handleEvent(event, { store, hub });
  });

  server.listen(port, () => {
    console.log(
      `[api] REST + WebSocket 已啟動於 http://localhost:${port}（ws: /ws）${
        serveStatic ? '，並提供 web 靜態產物' : ''
      }`
    );
  });

  const shutdown = (): void => {
    console.log('[api] 關閉中…');
    server.close();
    redis.disconnect();
    subRedis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * 統一處理訂閱到的事件：把語意事件轉為佇列狀態變動，並廣播最新 QueueState。
 * 匯出以便測試。
 */
export async function handleEvent(
  event: KtvEvent,
  deps: { store: KtvStore; hub: WebSocketHub }
): Promise<void> {
  const { store, hub } = deps;

  switch (event.type) {
    case KtvEventType.Skip:
      await store.advance();
      break;
    case KtvEventType.Pause:
      await store.setPaused(true);
      break;
    case KtvEventType.Play:
      await store.setPaused(false);
      break;
    case KtvEventType.QueueUpdated:
      // bot enqueue 後已帶最新狀態，直接廣播即可（不需再改 store）
      hub.broadcast({ type: event.type, payload: event.payload });
      return;
    default:
      return;
  }

  const state = await store.getState();
  hub.broadcast({ type: KtvEventType.QueueUpdated, payload: state });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[api] 啟動失敗:', err);
    process.exit(1);
  });
}
