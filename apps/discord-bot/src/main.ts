import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
} from 'discord.js';
import { KtvEventType, type DiscordConfig } from '@discord-ktv/shared-types';
import {
  ConfigStore,
  createRedis,
  KtvStore,
  subscribeEvent,
  type Redis,
} from '@discord-ktv/redis-client';
import { parseMessage } from './message-handler';
import { applyIntent } from './actions';
import { BotConnection } from './connection';
import { resolveDisplayName } from './display-name';

/**
 * 決定 bot 啟動時要套用的初始設定（純函式，方便測試）。
 *
 * 策略（Redis 優先，env 當初始種子）：
 * - Redis 已有 token → 直接用 Redis 的設定，seed=null（不需寫入）。
 * - Redis 無 token 但 env 有 DISCORD_TOKEN → 用 env 值組成設定，並回傳 seed 讓呼叫端
 *   寫入 Redis 當初始種子。
 * - 兩者皆無 → 空設定（bot 進待命）。
 *
 * @returns config：本次要 applyConfig 的設定；seed：需寫回 Redis 的種子（否則 null）
 */
export function resolveInitialConfig(
  redisConfig: DiscordConfig,
  env: { token?: string; channelId?: string }
): { config: DiscordConfig; seed: DiscordConfig | null } {
  if (redisConfig.token) {
    return { config: redisConfig, seed: null };
  }

  const envToken = env.token?.trim() || null;
  const envChannel = env.channelId?.trim() || null;

  if (envToken) {
    const seeded: DiscordConfig = { token: envToken, channelId: envChannel };
    return { config: seeded, seed: seeded };
  }

  // Redis 無 token、env 也無 token：維持 Redis 的 channelId（可能有），token 為空進待命
  return {
    config: { token: null, channelId: redisConfig.channelId ?? envChannel },
    seed: null,
  };
}

/**
 * Discord KTV bot 進入點。
 *
 * 職責：維持 Discord Gateway 長連線，監聽訊息；收到 YouTube 連結或控制指令時，
 * 透過 redis-client 更新佇列並 publish 事件（api 訂閱後推播給大螢幕前端）。
 *
 * 設定改為以 Redis 為單一事實來源（ktv:config:discord）：
 * - 啟動時 Redis 空但 env 有值則寫入 Redis 當種子。
 * - 缺 token 時 bot 待命不結束，等待網頁設定後熱啟動。
 * - 訂閱 ConfigUpdated 事件，收到後從 Redis 重讀 config 並熱重連。
 */
async function main(): Promise<void> {
  // 一般命令連線（enqueue / publish 用）
  const redis = createRedis();
  // 訂閱連線（進入 subscribe 模式後不可再下一般命令，需獨立）
  const subRedis = createRedis();
  const store = new KtvStore(redis);
  const configStore = new ConfigStore(redis);

  // client 以「目前這顆」的形式持有，熱重連時換新的 client
  let client: Client | null = null;

  // BotConnection 的連線管理器，注入真實 discord.js 副作用
  const connection = new BotConnection({
    login: async (token) => {
      client = createClient(connection, { store, pub: redis });
      await client.login(token);
    },
    destroy: async () => {
      if (client) {
        await client.destroy();
        client = null;
      }
    },
  });

  // 決定初始設定（Redis 優先，env 當種子）
  const redisConfig = await configStore.getConfig();
  const { config, seed } = resolveInitialConfig(redisConfig, {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_KTV_CHANNEL_ID,
  });
  if (seed) {
    await configStore.setConfig(seed);
    console.log('[discord-bot] 已把 env 設定寫入 Redis 當初始種子。');
  }
  await connection.applyConfig(config);

  // 訂閱 ConfigUpdated：從 Redis 重讀最新設定並熱重連（事件不帶明文 token）
  subscribeEvent(subRedis, (event) => {
    if (event.type !== KtvEventType.ConfigUpdated) return;
    void (async () => {
      try {
        const latest = await configStore.getConfig();
        await connection.applyConfig(latest);
      } catch (err) {
        console.error('[discord-bot] 套用新設定失敗:', err);
      }
    })();
  });

  const shutdown = async (): Promise<void> => {
    console.log('[discord-bot] 關閉中…');
    if (client) await client.destroy();
    redis.disconnect();
    subRedis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * 建立一顆設定好事件監聽的 discord.js Client。
 * 頻道過濾委由 BotConnection.isChannelAllowed（設定變更即時反映）。
 */
function createClient(
  connection: BotConnection,
  deps: { store: KtvStore; pub: Redis }
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[discord-bot] 已登入為 ${c.user.tag}，開始接收點歌訊息。`);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    // 忽略 bot 自己與其他 bot
    if (message.author.bot) return;
    // 頻道限制（由 BotConnection 內部 allowedChannel 決定）
    if (!connection.isChannelAllowed(message.channelId)) return;

    const intent = parseMessage(message.content);
    if (intent.kind === 'ignore') return;

    try {
      const reply = await applyIntent(intent, {
        store: deps.store,
        pub: deps.pub,
        requestedBy: resolveDisplayName({
          memberDisplayName: message.member?.displayName,
          globalName: message.author.globalName,
          username: message.author.username,
        }),
      });
      if (reply) {
        await message.reply(reply);
      }
    } catch (err) {
      console.error('[discord-bot] 處理訊息失敗:', err);
      await message
        .reply('處理點歌時發生錯誤，請稍後再試。')
        .catch(() => undefined);
    }
  });

  return client;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[discord-bot] 啟動失敗:', err);
    process.exit(1);
  });
}
