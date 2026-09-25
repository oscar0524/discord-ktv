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

  describe('nextSongNumber', () => {
    it('連續取號從 1000 起遞增', async () => {
      const { store } = makeStore();
      expect(await store.nextSongNumber()).toBe(1000);
      expect(await store.nextSongNumber()).toBe(1001);
      expect(await store.nextSongNumber()).toBe(1002);
    });

    it('跨越 9999 後繞回 1000', async () => {
      const { store, redis } = makeStore();
      // 先把計數器推進到 8999（對應第 9000 個號碼 9999）
      await redis.set('ktv:queue:counter', '8999');
      expect(await store.nextSongNumber()).toBe(9999); // counter -> 9000
      expect(await store.nextSongNumber()).toBe(1000); // counter -> 9001 繞回
      expect(await store.nextSongNumber()).toBe(1001);
    });
  });

  describe('enqueue 配號', () => {
    it('enqueue 後 song 帶遞增的 songNumber', async () => {
      const { store } = makeStore();
      const first = await store.enqueue(createSong('aaaaaaaaaaa', 'u1'));
      expect(first.current?.songNumber).toBe(1000);
      const second = await store.enqueue(createSong('bbbbbbbbbbb', 'u2'));
      expect(second.items[0].songNumber).toBe(1001);
    });
  });

  describe('moveToFront', () => {
    it('把指定編號的歌移到 items 首位，不影響 current', async () => {
      const { store } = makeStore();
      await store.enqueue(createSong('aaaaaaaaaaa', 'u1')); // current, 1000
      await store.enqueue(createSong('bbbbbbbbbbb', 'u2')); // items[0], 1001
      await store.enqueue(createSong('ccccccccccc', 'u3')); // items[1], 1002

      const state = await store.moveToFront(1002);
      expect(state.current?.songNumber).toBe(1000);
      expect(state.items.map((s) => s.songNumber)).toEqual([1002, 1001]);
    });

    it('找不到編號時狀態不變', async () => {
      const { store } = makeStore();
      await store.enqueue(createSong('aaaaaaaaaaa', 'u1'));
      await store.enqueue(createSong('bbbbbbbbbbb', 'u2'));
      const state = await store.moveToFront(9998);
      expect(state.items.map((s) => s.songNumber)).toEqual([1001]);
    });
  });

  describe('reorder', () => {
    it('依 id 陣列重排 items', async () => {
      const { store } = makeStore();
      await store.enqueue(createSong('aaaaaaaaaaa', 'u1')); // current
      const s2 = createSong('bbbbbbbbbbb', 'u2', { id: 'id-b' });
      const s3 = createSong('ccccccccccc', 'u3', { id: 'id-c' });
      const s4 = createSong('ddddddddddd', 'u4', { id: 'id-d' });
      await store.enqueue(s2);
      await store.enqueue(s3);
      await store.enqueue(s4);

      const state = await store.reorder(['id-d', 'id-b', 'id-c']);
      expect(state.items.map((s) => s.id)).toEqual(['id-d', 'id-b', 'id-c']);
    });

    it('忽略不存在的 id，未列出的項目保留於尾端', async () => {
      const { store } = makeStore();
      await store.enqueue(createSong('aaaaaaaaaaa', 'u1')); // current
      await store.enqueue(createSong('bbbbbbbbbbb', 'u2', { id: 'id-b' }));
      await store.enqueue(createSong('ccccccccccc', 'u3', { id: 'id-c' }));

      const state = await store.reorder(['ghost', 'id-c']);
      // id-c 排到最前、id-b 未列出保留於尾端、ghost 被忽略
      expect(state.items.map((s) => s.id)).toEqual(['id-c', 'id-b']);
    });
  });
});
