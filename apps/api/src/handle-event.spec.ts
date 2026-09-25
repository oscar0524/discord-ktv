import RedisMock from 'ioredis-mock';
import { KtvStore, type Redis } from '@discord-ktv/redis-client';
import {
  KtvEventType,
  createSong,
  emptyQueueState,
  type QueueState,
} from '@discord-ktv/shared-types';
import { WebSocketHub } from './ws-hub';
import { handleEvent } from './main';

/** 收集 hub 廣播出去的訊息 */
function makeHub(): { hub: WebSocketHub; broadcasts: unknown[] } {
  const hub = new WebSocketHub();
  const broadcasts: unknown[] = [];
  jest.spyOn(hub, 'broadcast').mockImplementation((msg) => {
    broadcasts.push(msg);
  });
  return { hub, broadcasts };
}

describe('handleEvent', () => {
  let redis: Redis;
  let store: KtvStore;

  beforeEach(async () => {
    await (new RedisMock() as unknown as Redis).flushall();
    redis = new RedisMock() as unknown as Redis;
    store = new KtvStore(redis);
  });

  it('Skip：推進佇列並廣播最新狀態', async () => {
    await store.enqueue(createSong('aaaaaaaaaaa', 'u1'));
    await store.enqueue(createSong('bbbbbbbbbbb', 'u2'));
    const { hub, broadcasts } = makeHub();

    await handleEvent({ type: KtvEventType.Skip, payload: {} }, { store, hub });

    expect((await store.getState()).current?.videoId).toBe('bbbbbbbbbbb');
    const last = broadcasts.at(-1) as { type: string; payload: QueueState };
    expect(last.type).toBe(KtvEventType.QueueUpdated);
    expect(last.payload.current?.videoId).toBe('bbbbbbbbbbb');
  });

  it('Pause / Play：切換旗標並廣播', async () => {
    const { hub } = makeHub();
    await handleEvent({ type: KtvEventType.Pause, payload: {} }, { store, hub });
    expect((await store.getState()).isPaused).toBe(true);
    await handleEvent({ type: KtvEventType.Play, payload: {} }, { store, hub });
    expect((await store.getState()).isPaused).toBe(false);
  });

  it('QueueUpdated：直接廣播事件帶的狀態，不改 store', async () => {
    const { hub, broadcasts } = makeHub();
    const payload = { ...emptyQueueState(), current: createSong('c', 'u') };
    await handleEvent(
      { type: KtvEventType.QueueUpdated, payload },
      { store, hub }
    );
    expect(broadcasts).toHaveLength(1);
    expect((broadcasts[0] as { payload: QueueState }).payload.current?.videoId).toBe(
      'c'
    );
  });

  it('Danmaku：直接廣播同型別同 payload，不改 store', async () => {
    await store.enqueue(createSong('aaaaaaaaaaa', 'u1'));
    const before = await store.getState();
    const { hub, broadcasts } = makeHub();

    await handleEvent(
      { type: KtvEventType.Danmaku, payload: { text: 'oscar：安安' } },
      { store, hub }
    );

    expect(broadcasts).toHaveLength(1);
    const msg = broadcasts[0] as { type: string; payload: { text: string } };
    expect(msg.type).toBe(KtvEventType.Danmaku);
    expect(msg.payload.text).toBe('oscar：安安');
    // store 狀態未變
    expect(await store.getState()).toEqual(before);
  });

  it('QueueMoveToFront：把指定編號移到 items 首位並廣播最新狀態', async () => {
    await store.enqueue(createSong('aaaaaaaaaaa', 'u1')); // current, 1000
    await store.enqueue(createSong('bbbbbbbbbbb', 'u2')); // items[0], 1001
    await store.enqueue(createSong('ccccccccccc', 'u3')); // items[1], 1002
    const { hub, broadcasts } = makeHub();

    await handleEvent(
      { type: KtvEventType.QueueMoveToFront, payload: { songNumber: 1002 } },
      { store, hub }
    );

    const state = await store.getState();
    expect(state.items.map((s) => s.songNumber)).toEqual([1002, 1001]);
    const last = broadcasts.at(-1) as { type: string; payload: QueueState };
    expect(last.type).toBe(KtvEventType.QueueUpdated);
    expect(last.payload.items.map((s) => s.songNumber)).toEqual([1002, 1001]);
  });

  it('QueueReorder：依 id 陣列重排並廣播最新狀態', async () => {
    await store.enqueue(createSong('aaaaaaaaaaa', 'u1')); // current
    await store.enqueue(createSong('bbbbbbbbbbb', 'u2', { id: 'id-b' }));
    await store.enqueue(createSong('ccccccccccc', 'u3', { id: 'id-c' }));
    const { hub, broadcasts } = makeHub();

    await handleEvent(
      { type: KtvEventType.QueueReorder, payload: { orderedIds: ['id-c', 'id-b'] } },
      { store, hub }
    );

    const state = await store.getState();
    expect(state.items.map((s) => s.id)).toEqual(['id-c', 'id-b']);
    const last = broadcasts.at(-1) as { type: string; payload: QueueState };
    expect(last.type).toBe(KtvEventType.QueueUpdated);
    expect(last.payload.items.map((s) => s.id)).toEqual(['id-c', 'id-b']);
  });
});
