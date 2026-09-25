import RedisMock from 'ioredis-mock';
import { KtvStore, type Redis } from '@discord-ktv/redis-client';
import { KtvEventType } from '@discord-ktv/shared-types';
import { applyIntent, formatHelp, formatQueueList } from './actions';

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

    // enqueue 會 publish QueueUpdated + Danmaku 兩則
    const types = published.map((e) => (e as { type: string }).type);
    expect(types).toEqual([KtvEventType.QueueUpdated, KtvEventType.Danmaku]);
    const danmaku = published[1] as { payload: { text: string } };
    expect(danmaku.payload.text).toContain('oscar');
    expect(danmaku.payload.text).toContain('Never Gonna Give You Up');
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

  it('enqueue：回覆含歌曲編號', async () => {
    const resolveTitle = jest.fn().mockResolvedValue('稻香');
    const reply = await applyIntent(
      { kind: 'enqueue', videoId: 'dQw4w9WgXcQ' },
      { store, pub: redis, requestedBy: 'oscar', resolveTitle }
    );
    // store 配發第一個編號 1000
    expect(reply).toContain('編號 1000');
  });

  it('list：回覆含播放中與待播清單、正確截斷至 10 首', async () => {
    const resolveTitle = jest.fn().mockResolvedValue(null);
    // 1 首 current + 12 首 items
    for (let i = 0; i < 13; i++) {
      await applyIntent(
        { kind: 'enqueue', videoId: `vid${i}______` },
        { store, pub: redis, requestedBy: `u${i}`, resolveTitle }
      );
    }
    const reply = await applyIntent(
      { kind: 'list' },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect(reply).toContain('播放中');
    expect(reply).toContain('接下來 10 首');
    // 第 10 列存在、第 11 列不存在
    expect(reply).toContain('10. 編號');
    expect(reply).not.toContain('11. 編號');
  });

  it('list：空佇列回友善訊息', async () => {
    const reply = await applyIntent(
      { kind: 'list' },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect(reply).toContain('待播清單是空的');
  });

  it('move_front：呼叫 store 並 publish 事件、回覆正確', async () => {
    const resolveTitle = jest.fn().mockResolvedValue(null);
    await applyIntent(
      { kind: 'enqueue', videoId: 'aaaaaaaaaaa' },
      { store, pub: redis, requestedBy: 'u1', resolveTitle }
    ); // current, 1000
    await applyIntent(
      { kind: 'enqueue', videoId: 'bbbbbbbbbbb' },
      { store, pub: redis, requestedBy: 'u2', resolveTitle }
    ); // items[0], 1001
    await applyIntent(
      { kind: 'enqueue', videoId: 'ccccccccccc' },
      { store, pub: redis, requestedBy: 'u3', resolveTitle }
    ); // items[1], 1002
    published.length = 0;

    const reply = await applyIntent(
      { kind: 'move_front', songNumber: 1002 },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect(reply).toContain('編號 1002');

    const state = await store.getState();
    expect(state.items.map((s) => s.songNumber)).toEqual([1002, 1001]);

    const types = published.map((e) => (e as { type: string }).type);
    expect(types).toEqual([
      KtvEventType.QueueMoveToFront,
      KtvEventType.QueueUpdated,
      KtvEventType.Danmaku,
    ]);
    const danmaku = published[2] as { payload: { text: string } };
    expect(danmaku.payload.text).toContain('插到最前面');
  });

  it('move_front：找不到編號時回提示、不 publish', async () => {
    const resolveTitle = jest.fn().mockResolvedValue(null);
    await applyIntent(
      { kind: 'enqueue', videoId: 'aaaaaaaaaaa' },
      { store, pub: redis, requestedBy: 'u1', resolveTitle }
    );
    published.length = 0;

    const reply = await applyIntent(
      { kind: 'move_front', songNumber: 9998 },
      { store, pub: redis, requestedBy: 'u' }
    );
    expect(reply).toContain('找不到編號 9998');
    expect(published).toHaveLength(0);
  });

  it('help：回傳說明文字且不 publish 任何事件', async () => {
    const reply = await applyIntent(
      { kind: 'help' },
      { store, pub: redis, requestedBy: 'oscar' }
    );
    expect(reply).not.toBeNull();
    expect(reply).toContain('插歌');
    expect(reply).toContain('說明');
    expect(published).toHaveLength(0);
  });

  describe('formatHelp（純函式）', () => {
    it('涵蓋所有指令關鍵字與行為說明', () => {
      const text = formatHelp();
      expect(text).toContain('插歌');
      expect(text).toContain('skip');
      expect(text).toContain('YouTube');
      expect(text).toContain('彈幕');
    });

    it('顯示「指令需帶前綴」提示與帶前綴的指令範例', () => {
      const text = formatHelp();
      // 前綴提示（同時提及 ! 與 /）
      expect(text).toContain('!');
      expect(text).toContain('/');
      expect(text).toContain('開頭');
      // 至少一個帶前綴的指令範例
      expect(text).toContain('!skip');
    });
  });

  describe('formatQueueList（純函式）', () => {
    it('空佇列回友善訊息', () => {
      const text = formatQueueList({
        items: [],
        current: null,
        isPaused: false,
      });
      expect(text).toContain('待播清單是空的');
    });
  });

  it('danmaku：publish Danmaku 事件（payload 為「暱稱：訊息」）且回傳 null', async () => {
    const reply = await applyIntent(
      { kind: 'danmaku', text: '今天天氣真好' },
      { store, pub: redis, requestedBy: 'oscar' }
    );
    expect(reply).toBeNull();

    expect(published).toHaveLength(1);
    const event = published[0] as { type: string; payload: { text: string } };
    expect(event.type).toBe(KtvEventType.Danmaku);
    expect(event.payload.text).toBe('oscar：今天天氣真好');
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
