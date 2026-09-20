import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { createSong } from '@discord-ktv/shared-types';
import { KtvStore } from './store';

function makeStore(): { store: KtvStore; redis: Redis } {
  // ioredis-mock 與 ioredis 介面相容，型別上以 Redis 對待
  const redis = new RedisMock() as unknown as Redis;
  return { store: new KtvStore(redis), redis };
}

describe('KtvStore', () => {
  beforeEach(async () => {
    // ioredis-mock 預設共享同一份記憶體資料集，測試間需清空以避免互相污染
    await (new RedisMock() as unknown as Redis).flushall();
  });

  it('初始（未初始化）回傳空狀態', async () => {
    const { store } = makeStore();
    const state = await store.getState();
    expect(state).toEqual({ items: [], current: null, isPaused: false });
  });

  it('第一首 enqueue 直接成為 current', async () => {
    const { store } = makeStore();
    const song = createSong('dQw4w9WgXcQ', 'oscar');
    const state = await store.enqueue(song);
    expect(state.current?.id).toBe(song.id);
    expect(state.items).toHaveLength(0);
  });

  it('後續 enqueue 排入 items，peek 仍為 current', async () => {
    const { store } = makeStore();
    const first = createSong('aaaaaaaaaaa', 'u1');
    const second = createSong('bbbbbbbbbbb', 'u2');
    await store.enqueue(first);
    const state = await store.enqueue(second);
    expect(state.current?.id).toBe(first.id);
    expect(state.items.map((s) => s.id)).toEqual([second.id]);

    const peeked = await store.peek();
    expect(peeked?.id).toBe(first.id);
  });

  it('advance 推進到下一首', async () => {
    const { store } = makeStore();
    const first = createSong('aaaaaaaaaaa', 'u1');
    const second = createSong('bbbbbbbbbbb', 'u2');
    await store.enqueue(first);
    await store.enqueue(second);

    const afterAdvance = await store.advance();
    expect(afterAdvance.current?.id).toBe(second.id);
    expect(afterAdvance.items).toHaveLength(0);

    const afterEmpty = await store.advance();
    expect(afterEmpty.current).toBeNull();
  });

  it('setPaused 切換暫停旗標', async () => {
    const { store } = makeStore();
    expect((await store.setPaused(true)).isPaused).toBe(true);
    expect((await store.setPaused(false)).isPaused).toBe(false);
  });

  it('clear 清空佇列', async () => {
    const { store } = makeStore();
    await store.enqueue(createSong('aaaaaaaaaaa', 'u1'));
    await store.enqueue(createSong('bbbbbbbbbbb', 'u2'));
    const cleared = await store.clear();
    expect(cleared).toEqual({ items: [], current: null, isPaused: false });
  });

  it('壞掉的 JSON 也回傳空狀態（防禦）', async () => {
    const { store, redis } = makeStore();
    await redis.set('ktv:queue:state', 'not-json');
    const state = await store.getState();
    expect(state.current).toBeNull();
  });
});
