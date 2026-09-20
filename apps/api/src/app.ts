import express, { type Express, type Request, type Response } from 'express';
import path from 'node:path';
import { KtvEventType, type KtvEvent } from '@discord-ktv/shared-types';
import { KtvStore } from '@discord-ktv/redis-client';

export interface AppDeps {
  store: KtvStore;
  /**
   * 發布一個控制事件到 Redis（由 main.ts 注入真正的 publish；測試注入 spy）。
   * 控制端點只負責發事件，實際佇列變動由訂閱端統一處理，維持單一資料流方向。
   */
  publish: (event: KtvEvent) => Promise<void>;
  /** all-in-one image 中，web 產物所在目錄；提供則掛上 express static */
  webStaticDir?: string;
}

/**
 * 建立 Express app（不含 HTTP server 與 WebSocket，方便用 supertest 測試）。
 *
 * REST 介面（見 specs/api.md）：
 * - GET  /health            健康檢查
 * - GET  /queue             取得目前 QueueState
 * - POST /control/skip      發布 Skip 事件
 * - POST /control/pause     發布 Pause 事件
 * - POST /control/play      發布 Play 事件
 * - POST /playback/ended    大螢幕播完一首，推進到下一首（等同 skip 的語意）
 */
export function createApp(deps: AppDeps): Express {
  const { store, publish, webStaticDir } = deps;
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/queue', async (_req: Request, res: Response) => {
    const state = await store.getState();
    res.json(state);
  });

  app.post('/control/skip', async (_req: Request, res: Response) => {
    await publish({ type: KtvEventType.Skip, payload: {} });
    res.json({ ok: true });
  });

  app.post('/control/pause', async (_req: Request, res: Response) => {
    await publish({ type: KtvEventType.Pause, payload: {} });
    res.json({ ok: true });
  });

  app.post('/control/play', async (_req: Request, res: Response) => {
    await publish({ type: KtvEventType.Play, payload: {} });
    res.json({ ok: true });
  });

  app.post('/playback/ended', async (_req: Request, res: Response) => {
    // 播完一首＝跳過目前這首，推進佇列。語意上與 skip 相同。
    await publish({ type: KtvEventType.Skip, payload: { reason: 'ended' } });
    res.json({ ok: true });
  });

  // all-in-one：由 Express 提供 web 靜態產物，SPA fallback 到 index.html
  if (webStaticDir) {
    app.use(express.static(webStaticDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(webStaticDir, 'index.html'));
    });
  }

  return app;
}
