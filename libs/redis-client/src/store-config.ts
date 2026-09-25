import type { Redis } from 'ioredis';
import {
  emptyDiscordConfig,
  type DiscordConfig,
} from '@discord-ktv/shared-types';
import { KEY_DISCORD_CONFIG } from './keys';

/**
 * ConfigStore 封裝 Discord bot 執行期設定的讀寫。
 *
 * 設計選擇：整份設定（token / channelId）以單一 JSON string 存於 KEY_DISCORD_CONFIG，
 * 沿用 KtvStore 的防禦式解析風格（壞資料回傳空設定）。
 *
 * 安全備註：token 為機密。此層只負責 Redis 讀寫，對外遮罩（不回明文 token）
 * 由 api 端點負責。
 */
export class ConfigStore {
  constructor(private readonly redis: Redis) {}

  /** 讀取目前 Discord 設定；尚未初始化或資料損壞時回傳空設定 */
  async getConfig(): Promise<DiscordConfig> {
    const raw = await this.redis.get(KEY_DISCORD_CONFIG);
    if (!raw) {
      return emptyDiscordConfig();
    }
    try {
      const parsed = JSON.parse(raw) as Partial<DiscordConfig>;
      return {
        token: typeof parsed.token === 'string' ? parsed.token : null,
        channelId:
          typeof parsed.channelId === 'string' ? parsed.channelId : null,
      };
    } catch {
      return emptyDiscordConfig();
    }
  }

  /** 覆寫整份 Discord 設定 */
  async setConfig(config: DiscordConfig): Promise<void> {
    await this.redis.set(KEY_DISCORD_CONFIG, JSON.stringify(config));
  }
}
