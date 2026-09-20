import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
} from 'discord.js';
import { createRedis, KtvStore } from '@discord-ktv/redis-client';
import { parseMessage } from './message-handler';
import { applyIntent } from './actions';

/**
 * Discord KTV bot 進入點。
 *
 * 職責：維持 Discord Gateway 長連線，監聽訊息；收到 YouTube 連結或控制指令時，
 * 透過 redis-client 更新佇列並 publish 事件（api 訂閱後推播給大螢幕前端）。
 */
async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error(
      '[discord-bot] 缺少 DISCORD_TOKEN，請參考 .env.example 設定後再啟動。'
    );
    process.exit(1);
  }

  const allowedChannel = process.env.DISCORD_KTV_CHANNEL_ID?.trim() || null;

  // 一般命令連線（enqueue / publish 用）
  const redis = createRedis();
  const store = new KtvStore(redis);

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
    // 若設定了頻道限制，只處理該頻道
    if (allowedChannel && message.channelId !== allowedChannel) return;

    const intent = parseMessage(message.content);
    if (intent.kind === 'ignore') return;

    try {
      const reply = await applyIntent(intent, {
        store,
        pub: redis,
        requestedBy: message.author.username,
      });
      if (reply) {
        await message.reply(reply);
      }
    } catch (err) {
      console.error('[discord-bot] 處理訊息失敗:', err);
      await message.reply('處理點歌時發生錯誤，請稍後再試。').catch(() => undefined);
    }
  });

  const shutdown = async (): Promise<void> => {
    console.log('[discord-bot] 關閉中…');
    await client.destroy();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await client.login(token);
}

main().catch((err) => {
  console.error('[discord-bot] 啟動失敗:', err);
  process.exit(1);
});
