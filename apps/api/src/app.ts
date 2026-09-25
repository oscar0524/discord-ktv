import express, { type Express, type Request, type Response } from 'express';
import path from 'node:path';
import { KtvEventType, type KtvEvent } from '@discord-ktv/shared-types';
import { ConfigStore, KtvStore } from '@discord-ktv/redis-client';

export interface AppDeps {
  store: KtvStore;
  /**
   * 發布一個控制事件到 Redis（由 main.ts 注入真正的 publish；測試注入 spy）。
   * 控制端點只負責發事件，實際佇列變動由訂閱端統一處理，維持單一資料流方向。
   */
  publish: (event: KtvEvent) => Promise<void>;
  /** Discord 設定的讀寫（GET 遮罩 / PUT 寫入後 publish ConfigUpdated） */
  configStore: ConfigStore;
  /** all-in-one image 中，web 產物所在目錄；提供則掛上 express static */
  webStaticDir?: string;
}

/** channelId 合法性：null / 空字串（不限制），或純數字字串 */
function isValidChannelId(value: unknown): value is string | null {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  return typeof value === 'string' && /^\d+$/.test(value);
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
 * - GET  /config/discord    取得 Discord 設定的遮罩狀態（hasToken / channelId）
 * - PUT  /config/discord    更新 Discord 設定，寫入 Redis 後 publish ConfigUpdated
 */
export function createApp(deps: AppDeps): Express {
  const { store, publish, configStore, webStaticDir } = deps;
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

  // 取得 Discord 設定的遮罩狀態。安全：一律不回傳明文 token，只回 hasToken 布林。
  app.get('/config/discord', async (_req: Request, res: Response) => {
    const config = await configStore.getConfig();
    res.json({
      hasToken: Boolean(config.token),
      channelId: config.channelId,
    });
  });

  // 更新 Discord 設定。token 省略時保留原值（允許只改 channelId）；channelId 需純數字或空/null。
  app.put('/config/discord', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      token?: unknown;
      channelId?: unknown;
    };

    // token：省略（undefined）表示不變更；提供時須為非空字串
    const tokenProvided = body.token !== undefined;
    if (tokenProvided && (typeof body.token !== 'string' || body.token.trim() === '')) {
      res.status(400).json({ error: 'token 不可為空字串' });
      return;
    }

    // channelId：省略表示不變更；提供時須為純數字字串或空/null
    const channelProvided = body.channelId !== undefined;
    if (channelProvided && !isValidChannelId(body.channelId)) {
      res.status(400).json({ error: 'channelId 必須為純數字字串或留空' });
      return;
    }

    const current = await configStore.getConfig();
    const next = {
      token: tokenProvided ? (body.token as string) : current.token,
      channelId: channelProvided
        ? (body.channelId as string) === ''
          ? null
          : (body.channelId as string | null)
        : current.channelId,
    };

    await configStore.setConfig(next);
    // 安全：不把明文 token 放進事件，bot 收到後自行從 Redis 重讀
    await publish({ type: KtvEventType.ConfigUpdated, payload: {} });

    res.json({ hasToken: Boolean(next.token), channelId: next.channelId });
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
