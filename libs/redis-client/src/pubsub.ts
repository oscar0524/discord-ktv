import type { Redis } from 'ioredis';
import type { KtvEvent } from '@discord-ktv/shared-types';
import { CHANNEL_EVENTS } from './keys';

/**
 * 發布一個 KTV 事件到共用頻道。
 * 使用「一般命令連線」（非 subscribe 模式的連線）。
 */
export async function publishEvent(redis: Redis, event: KtvEvent): Promise<void> {
  await redis.publish(CHANNEL_EVENTS, JSON.stringify(event));
}

/**
 * 訂閱 KTV 事件。
 *
 * 重要：傳入的 redis 連線會進入 subscribe 模式，之後不可再用來下一般命令，
 * 請使用獨立連線（見 createRedis 的說明）。
 *
 * @returns 取消訂閱的函式
 */
export function subscribeEvent(
  redis: Redis,
  handler: (event: KtvEvent) => void
): () => void {
  const onMessage = (channel: string, message: string): void => {
    if (channel !== CHANNEL_EVENTS) {
      return;
    }
    try {
      handler(JSON.parse(message) as KtvEvent);
    } catch {
      // 忽略無法解析的訊息，避免單筆壞資料打斷訂閱
    }
  };

  void redis.subscribe(CHANNEL_EVENTS);
  redis.on('message', onMessage);

  return () => {
    redis.off('message', onMessage);
    void redis.unsubscribe(CHANNEL_EVENTS);
  };
}
