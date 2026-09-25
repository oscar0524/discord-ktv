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
  /**
   * 允許的 CORS 來源清單（開發時前端在 http://localhost:4200，與 API :3333 跨來源）。
   * 省略或空陣列表示不啟用 CORS（例如 all-in-one 同源部署時不需要）。
   */
  corsOrigins?: string[];
}

/**
 * 依允許清單建立一個極簡 CORS middleware（不引入額外套件，維持 lockfile 乾淨）。
 * - 只有當 request 的 Origin 命中清單時，才回對應的 Access-Control-Allow-Origin。
 * - 預檢請求（OPTIONS）直接回 204。
 * 前端目前不帶 cookie，故不需要 Access-Control-Allow-Credentials。
 */
function corsMiddleware(allowed: string[]) {
  const allowSet = new Set(allowed);
  return (req: Request, res: Response, next: () => void): void => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && allowSet.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
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
 * - POST /control/move-front 發布 QueueMoveToFront 事件（body: { songNumber }）
 * - POST /control/reorder    發布 QueueReorder 事件（body: { orderedIds }）
 * - POST /playback/ended    大螢幕播完一首，推進到下一首（等同 skip 的語意）
 * - GET  /config/discord    取得 Discord 設定的遮罩狀態（hasToken / channelId）
 * - PUT  /config/discord    更新 Discord 設定，寫入 Redis 後 publish ConfigUpdated
 */
export function createApp(deps: AppDeps): Express {
  const { store, publish, configStore, webStaticDir, corsOrigins } = deps;
  const app = express();
  if (corsOrigins && corsOrigins.length > 0) {
    app.use(corsMiddleware(corsOrigins));
  }
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

  // 把指定編號的歌插到最前面。僅發事件，由訂閱端套用 store.moveToFront 並廣播。
  app.post('/control/move-front', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { songNumber?: unknown };
    if (typeof body.songNumber !== 'number' || !Number.isInteger(body.songNumber)) {
      res.status(400).json({ error: 'songNumber 必須為整數' });
      return;
    }
    await publish({
      type: KtvEventType.QueueMoveToFront,
      payload: { songNumber: body.songNumber },
    });
    res.json({ ok: true });
  });

  // 依完整 id 順序重排待播清單。僅發事件，由訂閱端套用 store.reorder 並廣播。
  app.post('/control/reorder', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { orderedIds?: unknown };
    if (
      !Array.isArray(body.orderedIds) ||
      !body.orderedIds.every((id) => typeof id === 'string')
    ) {
      res.status(400).json({ error: 'orderedIds 必須為字串陣列' });
      return;
    }
    await publish({
      type: KtvEventType.QueueReorder,
      payload: { orderedIds: body.orderedIds as string[] },
    });
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
