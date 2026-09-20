/**
 * Redis key / channel 命名的單一事實來源。
 * 對應 specs/redis-schema.md。
 */

/** 佇列狀態（含 items / current / isPaused）以單一 JSON string 存放 */
export const KEY_QUEUE_STATE = 'ktv:queue:state';

/** Pub/Sub 頻道：所有 KTV 事件（QueueUpdated / Skip / Pause / Play） */
export const CHANNEL_EVENTS = 'ktv:events';
