import Redis, { type RedisOptions } from 'ioredis';

/**
 * 建立一個 ioredis 連線。
 *
 * @param url Redis 連線字串（預設讀 process.env.REDIS_URL，再退回 localhost）
 * @param options 額外的 ioredis 選項
 *
 * 備註：Pub/Sub 的訂閱端與一般命令端「不可共用同一條連線」（進入 subscribe 模式後
 * 該連線只能收發 pub/sub 指令）。因此需要同時做讀寫與訂閱的服務（如 api）應建立兩條連線。
 */
export function createRedis(url?: string, options: RedisOptions = {}): Redis {
  const connectionUrl = url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(connectionUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: null,
    ...options,
  });
}

export type { Redis };
