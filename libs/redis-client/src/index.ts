/**
 * @discord-ktv/redis-client
 *
 * 以 ioredis 封裝的 Redis 存取層：連線工廠、佇列狀態存取（KtvStore）、
 * Pub/Sub 事件發布與訂閱。bot 與 api 皆透過此 lib 與 Redis 互動。
 */
export { createRedis, type Redis } from './connection';
export { KtvStore } from './store';
export { ConfigStore } from './store-config';
export { publishEvent, subscribeEvent } from './pubsub';
export { KEY_QUEUE_STATE, CHANNEL_EVENTS, KEY_DISCORD_CONFIG } from './keys';
