import RedisMock from 'ioredis-mock';
import { KtvStore, type Redis } from '@discord-ktv/redis-client';
import { KtvEventType } from '@discord-ktv/shared-types';
import { applyIntent } from './actions';

describe('applyIntent', () => {
  let redis: Redis;
  let store: KtvStore;
  let published: unknown[];

  beforeEach(async () => {
    await (new RedisMock() as unknown as Redis).flushall();
    redis = new RedisMock() as unknown as Redis;
    store = new KtvStore(redis);
    published = [];
    // 攔截 publish 以驗證事件（避免依賴另一條訂閱連線）
    jest
      .spyOn(redis, 'publish')
      // @ts-expect-error 測試用簡化簽名
      .mockImplementation((_channel: string, message: string) => {
        published.push(JSON.parse(message));
        return Promise.resolve(1);
      });
  });

  it('enqueue：寫入佇列並 publish QueueUpdated，回覆含歌名', async () => {
    const resolveTitle = jest.fn().mockResolvedValue('Never Gonna Give You Up');
    const reply = await applyIntent(
      { kind: 'enqueue', videoId: 'dQw4w9WgXcQ' },
      { store, pub: redis, requestedBy: 'oscar', resolveTitle }
    );
    expect(reply).toContain('Never Gonna Give You Up');

    const state = await store.getState();
    expect(state.current?.videoId).toBe('dQw4w9WgXcQ');
    expect(state.current?.title).toBe('Never Gonna Give You Up');
    expect(state.current?.requestedBy).toBe('oscar');
    expect(resolveTitle).toHaveBeenCalledWith('dQw4w9WgXcQ');

    expect(published).toHaveLength(1);
    expect((published[0] as { type: string }).type).toBe(
      KtvEventType.QueueUpdated
    );
  });

  it('enqueue：抓標題失敗（回 null）時不設 title，回覆 fallback 到 videoId', async () => {
    const resolveTitle = jest.fn().mockResolvedValue(null);
    const reply = await applyIntent(
      { kind: 'enqueue', videoId: 'dQw4w9WgXcQ' },
      { store, pub: redis, requestedBy: 'oscar', resolveTitle }
    );
    expect(reply).toContain('dQw4w9WgXcQ');

    const state = await store.getState();
    expect(state.current?.title).toBeUndefined();
  });

  it('skip：推進佇列並 publish Skip + QueueUpdated', async () => {
    const resolveTitle = jest.fn().mockResolvedValue(null);
    await applyIntent(
      { kind: 'enqueue', videoId: 'aaaaaaaaaaa' },
      { store, pub: redis, requestedBy: 'u1', resolveTitle }
    );
    await applyIntent(
      { kind: 'enqueue', videoId: 'bbbbbbbbbbb' },
      { store, pub: redis, requestedBy: 'u2', resolveTitle }
    );
    published.length = 0;

    const reply = await applyIntent(
      { kind: 'skip' },
      { store, pub: redis, requestedBy: 'u1' }
    );
    expect(reply).toContain('跳過');

    const state = await store.getState();
    expect(state.current?.videoId).toBe('bbbbbbbbbbb');

    const types = published.map((e) => (e as { type: string }).type);
    expect(types).toEqual([KtvEventType.Skip, KtvEventType.QueueUpdated]);
  });

  it('pause / play：切換暫停旗標並發對應事件', async () => {
    await applyIntent(
      { kind: 'pause' },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect((await store.getState()).isPaused).toBe(true);

    await applyIntent({ kind: 'play' }, { store, pub: redis, requestedBy: 'u' });
    expect((await store.getState()).isPaused).toBe(false);
  });

  it('ignore：不動作、回傳 null', async () => {
    const reply = await applyIntent(
      { kind: 'ignore' },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect(reply).toBeNull();
    expect(published).toHaveLength(0);
  });
});
