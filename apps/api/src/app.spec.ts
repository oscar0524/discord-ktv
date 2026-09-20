import request from 'supertest';
import RedisMock from 'ioredis-mock';
import { KtvStore, type Redis } from '@discord-ktv/redis-client';
import {
  KtvEventType,
  createSong,
  type KtvEvent,
} from '@discord-ktv/shared-types';
import { createApp } from './app';

function setup() {
  const redis = new RedisMock() as unknown as Redis;
  const store = new KtvStore(redis);
  const published: KtvEvent[] = [];
  const app = createApp({
    store,
    publish: async (event) => {
      published.push(event);
    },
  });
  return { app, store, published };
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
});
