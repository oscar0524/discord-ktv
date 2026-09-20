# Redis 資料結構與命名

單一事實來源見 `libs/redis-client/src/keys.ts`。

## Keys

| Key | 型別 | 說明 |
| --- | --- | --- |
| `ktv:queue:state` | String（JSON） | 整個佇列狀態，序列化的 `QueueState`。 |

### `ktv:queue:state` 的內容

對應 `QueueState`（`libs/shared-types`）：

```jsonc
{
  "items": [            // 待播清單（不含播放中）
    {
      "id": "uuid",     // 佇列項目唯一 id
      "videoId": "dQw4w9WgXcQ",
      "title": "稻香",   // 可選
      "requestedBy": "oscar",
      "requestedAt": 1737000000000
    }
  ],
  "current": null,      // 播放中的 Song，或 null
  "isPaused": false
}
```

設計說明：單一全域佇列、資料量小，整個狀態存一顆 key 最單純，也讓「推播完整
`QueueState`」很自然。若未來要多包廂，改為 `ktv:room:{roomId}:state` 等 per-room key。

## Channels（Pub/Sub）

| Channel | 說明 |
| --- | --- |
| `ktv:events` | 所有 KTV 事件（`QueueUpdated` / `Skip` / `Pause` / `Play`），payload 為序列化的 `KtvEvent`。 |

事件格式與語意見 [events.md](./events.md)。

## 連線注意事項

- Pub/Sub 的訂閱端連線進入 subscribe 模式後不可再下一般命令，因此需要同時「讀寫佇列」
  與「訂閱事件」的服務（如 `api`）必須建立兩條連線（見 `createRedis`）。
