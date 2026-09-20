import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import { KtvEventType, emptyQueueState } from '@discord-ktv/shared-types';
import { publishEvent, subscribeEvent } from './pubsub';

describe('pub/sub', () => {
  it('publish 的事件會被 subscribe 端收到', async () => {
    // ioredis-mock：不同實例共享同一個 pub/sub bus，因此可分別當 publisher / subscriber
    const pub = new RedisMock() as unknown as Redis;
    const sub = new RedisMock() as unknown as Redis;

    const received: unknown[] = [];
    const unsubscribe = subscribeEvent(sub, (event) => {
      received.push(event);
    });

    // 等待 subscribe 完成
    await new Promise((r) => setTimeout(r, 20));

    await publishEvent(pub, {
      type: KtvEventType.QueueUpdated,
      payload: emptyQueueState(),
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe(
      KtvEventType.QueueUpdated
    );

    unsubscribe();
  });
});
