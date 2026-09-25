import request from 'supertest';
import RedisMock from 'ioredis-mock';
import { ConfigStore, KtvStore, type Redis } from '@discord-ktv/redis-client';
import {
  KtvEventType,
  createSong,
  type KtvEvent,
} from '@discord-ktv/shared-types';
import { createApp } from './app';

function setup(overrides: { corsOrigins?: string[] } = {}) {
  const redis = new RedisMock() as unknown as Redis;
  const store = new KtvStore(redis);
  const configStore = new ConfigStore(redis);
  const published: KtvEvent[] = [];
  const app = createApp({
    store,
    configStore,
    publish: async (event) => {
      published.push(event);
    },
    ...overrides,
  });
  return { app, store, configStore, published };
}

describe('api app', () => {
  beforeEach(async () => {
    await (new RedisMock() as unknown as Redis).flushall();
  });

  it('GET /health 回傳 ok', async () => {
    const { app } = setup();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /queue 回傳目前佇列狀態', async () => {
    const { app, store } = setup();
    await store.enqueue(createSong('dQw4w9WgXcQ', 'oscar'));
    const res = await request(app).get('/queue');
    expect(res.status).toBe(200);
    expect(res.body.current.videoId).toBe('dQw4w9WgXcQ');
  });

  it.each([
    ['/control/skip', KtvEventType.Skip],
    ['/control/pause', KtvEventType.Pause],
    ['/control/play', KtvEventType.Play],
  ])('POST %s 發布 %s 事件', async (route, type) => {
    const { app, published } = setup();
    const res = await request(app).post(route);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(published.at(-1)?.type).toBe(type);
  });

  it('POST /playback/ended 發布 Skip 事件 (reason=ended)', async () => {
    const { app, published } = setup();
    const res = await request(app).post('/playback/ended');
    expect(res.status).toBe(200);
    const last = published.at(-1);
    expect(last?.type).toBe(KtvEventType.Skip);
    expect((last?.payload as { reason?: string }).reason).toBe('ended');
  });

  describe('control/move-front', () => {
    it('POST 帶合法 songNumber 發布 QueueMoveToFront 事件', async () => {
      const { app, published } = setup();
      const res = await request(app)
        .post('/control/move-front')
        .send({ songNumber: 1234 });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      const last = published.at(-1);
      expect(last?.type).toBe(KtvEventType.QueueMoveToFront);
      expect((last?.payload as { songNumber: number }).songNumber).toBe(1234);
    });

    it('POST 非整數 songNumber 回 400、不 publish', async () => {
      const { app, published } = setup();
      const res = await request(app)
        .post('/control/move-front')
        .send({ songNumber: 'abc' });
      expect(res.status).toBe(400);
      expect(published).toHaveLength(0);
    });
  });

  describe('control/reorder', () => {
    it('POST 帶字串陣列 orderedIds 發布 QueueReorder 事件', async () => {
      const { app, published } = setup();
      const res = await request(app)
        .post('/control/reorder')
        .send({ orderedIds: ['a', 'b', 'c'] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      const last = published.at(-1);
      expect(last?.type).toBe(KtvEventType.QueueReorder);
      expect((last?.payload as { orderedIds: string[] }).orderedIds).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('POST orderedIds 非字串陣列回 400、不 publish', async () => {
      const { app, published } = setup();
      const res = await request(app)
        .post('/control/reorder')
        .send({ orderedIds: [1, 2, 3] });
      expect(res.status).toBe(400);
      expect(published).toHaveLength(0);
    });
  });

  describe('config/discord', () => {
    it('GET 未設定時回 hasToken=false、channelId=null', async () => {
      const { app } = setup();
      const res = await request(app).get('/config/discord');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasToken: false, channelId: null });
    });

    it('GET 已設定時遮罩 token（不回明文）', async () => {
      const { app, configStore } = setup();
      await configStore.setConfig({ token: 'secret', channelId: '123' });
      const res = await request(app).get('/config/discord');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasToken: true, channelId: '123' });
      expect(JSON.stringify(res.body)).not.toContain('secret');
    });

    it('PUT 寫入 token+channelId 並 publish ConfigUpdated', async () => {
      const { app, configStore, published } = setup();
      const res = await request(app)
        .put('/config/discord')
        .send({ token: 'new-token', channelId: '456' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ hasToken: true, channelId: '456' });
      // 事件不帶明文 token
      const last = published.at(-1);
      expect(last?.type).toBe(KtvEventType.ConfigUpdated);
      expect(JSON.stringify(last)).not.toContain('new-token');
      // Redis 實際存了明文
      expect(await configStore.getConfig()).toEqual({
        token: 'new-token',
        channelId: '456',
      });
    });

    it('PUT channelId 非數字回 400', async () => {
      const { app, published } = setup();
      const res = await request(app)
        .put('/config/discord')
        .send({ token: 't', channelId: 'abc' });
      expect(res.status).toBe(400);
      expect(published).toHaveLength(0);
    });

    it('PUT token 省略時保留舊 token，只改 channelId', async () => {
      const { app, configStore } = setup();
      await configStore.setConfig({ token: 'keep-me', channelId: '111' });
      const res = await request(app)
        .put('/config/discord')
        .send({ channelId: '222' });
      expect(res.status).toBe(200);
      expect(await configStore.getConfig()).toEqual({
        token: 'keep-me',
        channelId: '222',
      });
    });

    it('PUT channelId 傳空字串視為清除（null）', async () => {
      const { app, configStore } = setup();
      await configStore.setConfig({ token: 'keep-me', channelId: '111' });
      const res = await request(app)
        .put('/config/discord')
        .send({ channelId: '' });
      expect(res.status).toBe(200);
      expect(res.body.channelId).toBeNull();
      expect(await configStore.getConfig()).toEqual({
        token: 'keep-me',
        channelId: null,
      });
    });

    it('PUT token 傳空字串回 400', async () => {
      const { app } = setup();
      const res = await request(app)
        .put('/config/discord')
        .send({ token: '   ' });
      expect(res.status).toBe(400);
    });
  });

  describe('CORS', () => {
    const ORIGIN = 'http://localhost:4200';

    it('允許清單內的 Origin 會回對應的 Allow-Origin header', async () => {
      const { app } = setup({ corsOrigins: [ORIGIN] });
      const res = await request(app).get('/queue').set('Origin', ORIGIN);
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(res.headers['vary']).toContain('Origin');
    });

    it('不在允許清單的 Origin 不會回 Allow-Origin header', async () => {
      const { app } = setup({ corsOrigins: [ORIGIN] });
      const res = await request(app)
        .get('/queue')
        .set('Origin', 'http://evil.example');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('OPTIONS 預檢回 204 並帶上 CORS header', async () => {
      const { app } = setup({ corsOrigins: [ORIGIN] });
      const res = await request(app)
        .options('/config/discord')
        .set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'PUT');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(res.headers['access-control-allow-methods']).toContain('PUT');
      expect(res.headers['access-control-allow-headers']).toContain(
        'Content-Type'
      );
    });

    it('未設定 corsOrigins 時不加任何 CORS header', async () => {
      const { app } = setup();
      const res = await request(app).get('/queue').set('Origin', ORIGIN);
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
