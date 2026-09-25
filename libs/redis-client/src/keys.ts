/**
 * Redis key / channel 命名的單一事實來源。
 * 對應 specs/redis-schema.md。
 */

/** 佇列狀態（含 items / current / isPaused）以單一 JSON string 存放 */
export const KEY_QUEUE_STATE = 'ktv:queue:state';

/** 歌曲編號全域遞增計數器（INCR），映射到 1000~9999 循環 */
export const KEY_QUEUE_COUNTER = 'ktv:queue:counter';

/**
 * Pub/Sub 頻道：所有 KTV 事件
 * （QueueUpdated / Skip / Pause / Play / QueueMoveToFront / QueueReorder / ConfigUpdated / Danmaku）
 */
export const CHANNEL_EVENTS = 'ktv:events';

/** Discord bot 執行期設定（token / channelId）以單一 JSON string 存放 */
export const KEY_DISCORD_CONFIG = 'ktv:config:discord';
