import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';
import type { DiscordConfig } from '@discord-ktv/shared-types';
import { ConfigStore } from './store-config';
import { KEY_DISCORD_CONFIG } from './keys';

function makeStore(): { store: ConfigStore; redis: Redis } {
  const redis = new RedisMock() as unknown as Redis;
  return { store: new ConfigStore(redis), redis };
}

describe('ConfigStore', () => {
  beforeEach(async () => {
    // ioredis-mock 預設共享同一份記憶體資料集，測試間需清空以避免互相污染
    await (new RedisMock() as unknown as Redis).flushall();
  });

  it('未初始化回傳空設定', async () => {
    const { store } = makeStore();
    const config = await store.getConfig();
    expect(config).toEqual({ token: null, channelId: null });
  });

  it('set 後 get 一致', async () => {
    const { store } = makeStore();
    const config: DiscordConfig = { token: 'secret-token', channelId: '12345' };
    await store.setConfig(config);
    expect(await store.getConfig()).toEqual(config);
  });

  it('壞掉的 JSON 回傳空設定（防禦）', async () => {
    const { store, redis } = makeStore();
    await redis.set(KEY_DISCORD_CONFIG, 'not-json');
    expect(await store.getConfig()).toEqual({ token: null, channelId: null });
  });

  it('缺欄位或型別不符時該欄位回 null', async () => {
    const { store, redis } = makeStore();
    await redis.set(KEY_DISCORD_CONFIG, JSON.stringify({ token: 123 }));
    expect(await store.getConfig()).toEqual({ token: null, channelId: null });
  });
});
