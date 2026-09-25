# Redis 資料結構與命名

單一事實來源見 `libs/redis-client/src/keys.ts`。

## Keys

| Key                  | 型別           | 說明                                                                        |
| -------------------- | -------------- | --------------------------------------------------------------------------- |
| `ktv:queue:state`    | String（JSON） | 整個佇列狀態，序列化的 `QueueState`。                                       |
| `ktv:config:discord` | String（JSON） | Discord bot 執行期設定，序列化的 `DiscordConfig`（`token` / `channelId`）。 |

### `ktv:queue:state` 的內容

對應 `QueueState`（`libs/shared-types`）：

```jsonc
{
  "items": [
    // 待播清單（不含播放中）
    {
      "id": "uuid", // 佇列項目唯一 id
      "videoId": "dQw4w9WgXcQ",
      "title": "稻香", // 可選
      "requestedBy": "oscar",
      "requestedAt": 1737000000000,
    },
  ],
  "current": null, // 播放中的 Song，或 null
  "isPaused": false,
}
```

設計說明：單一全域佇列、資料量小，整個狀態存一顆 key 最單純，也讓「推播完整
`QueueState`」很自然。若未來要多包廂，改為 `ktv:room:{roomId}:state` 等 per-room key。

### `ktv:config:discord` 的內容

對應 `DiscordConfig`（`libs/shared-types`），由 `ConfigStore`（`libs/redis-client`）讀寫：

```jsonc
{
  "token": "bot-token", // Discord bot token；null 表示未設定，bot 進入待命
  "channelId": "123", // 限定監聽的頻道 id（純數字字串）；null 表示不限制
}
```

設定來源與持久化：

- Redis 為單一事實來源，env（`DISCORD_TOKEN` / `DISCORD_KTV_CHANNEL_ID`）僅為初始種子。
  bot 啟動時若 Redis 尚無 token 但 env 有值，會把 env 寫入 Redis 當初始值。
- 可經由 api 的 `PUT /config/discord` 更新（見 api.md），更新後 publish `ConfigUpdated`，
  bot 收到即從 Redis 重讀並熱重連。
- 安全：`token` 為機密，只存於 Redis；api 的 GET 一律遮罩（回 `hasToken` 布林，不回明文）。
  `ConfigUpdated` 事件也不帶明文 token。
- 持久化：all-in-one image 的 Redis 開啟 AOF（`--appendonly yes --dir /data`）並掛 volume；
  dev compose 的 redis 亦掛具名 volume。

## Channels（Pub/Sub）

| Channel      | 說明                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `ktv:events` | 所有 KTV 事件（`QueueUpdated` / `Skip` / `Pause` / `Play` / `ConfigUpdated`），payload 為序列化的 `KtvEvent`。 |

事件格式與語意見 [events.md](./events.md)。

## 連線注意事項

- Pub/Sub 的訂閱端連線進入 subscribe 模式後不可再下一般命令，因此需要同時「讀寫佇列」
  與「訂閱事件」的服務（如 `api`）必須建立兩條連線（見 `createRedis`）。
