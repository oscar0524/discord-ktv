# 事件與 WebSocket 訊息協定

型別定義見 `libs/shared-types/src/index.ts`。

## Pub/Sub 事件（`ktv:events` 頻道）

事件形狀為 `KtvEvent`：`{ type, payload }`。

| `type` (`KtvEventType`) | 值                    | 發布者                       | payload                    | 語意                                                                                                   |
| ----------------------- | --------------------- | ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `QueueUpdated`          | `queue_updated`       | discord-bot（enqueue 後）    | `QueueState`               | 佇列內容已變動，帶最新完整狀態。                                                                       |
| `Skip`                  | `skip`                | discord-bot / api 控制端點   | `{ reason?: string }`      | 跳過目前歌曲（`reason: "ended"` 表示播完自動跳）。                                                     |
| `Pause`                 | `pause`               | discord-bot / api 控制端點   | `{}`                       | 暫停播放。                                                                                             |
| `Play`                  | `play`                | discord-bot / api 控制端點   | `{}`                       | 繼續播放。                                                                                             |
| `QueueMoveToFront`      | `queue_move_to_front` | discord-bot / api 控制端點   | `{ songNumber: number }`   | 把指定 4 位編號的歌插到待播清單最前面（成為下一首），不打斷 `current`。                                |
| `QueueReorder`          | `queue_reorder`       | api 控制端點（web 拖曳）     | `{ orderedIds: string[] }` | 依傳入的完整 id 順序重排待播清單 `items`。                                                             |
| `ConfigUpdated`         | `config_updated`      | api（`PUT /config/discord`） | `{}`                       | Discord 設定已更新；**payload 不帶明文 token**，訂閱端（bot）收到後自行從 Redis 重讀最新設定並熱重連。 |
| `Danmaku`               | `danmaku`             | discord-bot（非命令閒聊）    | `{ text: string }`         | 彈幕訊息，`text` 為已格式化的「暱稱：訊息」（bot 端截斷至 80 字）。一次性通知，不影響佇列狀態。        |

### 事件如何被套用

`api` 訂閱 `ktv:events` 後，於 `handleEvent` 統一處理：

- `Skip` → `KtvStore.advance()`（推進到下一首）
- `Pause` → `KtvStore.setPaused(true)`
- `Play` → `KtvStore.setPaused(false)`
- `QueueMoveToFront` → `KtvStore.moveToFront(payload.songNumber)`（把該編號的歌移到 `items[0]`）
- `QueueReorder` → `KtvStore.reorder(payload.orderedIds)`（依 id 順序重排 `items`）
- `QueueUpdated` → 不改狀態，直接把事件帶的 `QueueState` 廣播
- `Danmaku` → 不改狀態，直接把事件（含 `{ text }`）原樣廣播給前端（一次性通知）
- `ConfigUpdated` → api 不處理（與佇列無關）；由 `discord-bot` 訂閱，收到後重讀 `ktv:config:discord` 並 `BotConnection.applyConfig()` 熱重連。

套用後（除 `QueueUpdated` 與 `ConfigUpdated` 外），`api` 會讀取最新狀態並廣播一則 `QueueUpdated`。

## WebSocket 訊息（server → client）

前端連上 `/ws` 後：

1. 連線建立時，`api` 立即推一則 `QueueUpdated`（目前狀態），前端據此初始化。
2. 之後每當佇列變動，`api` 推送 `QueueUpdated`（`ServerMessage`）：

```jsonc
{
  "type": "queue_updated",
  "payload": { "items": [ /* Song[] */ ], "current": { /* Song */ } | null, "isPaused": false }
}
```

前端的 `useQueue` 只處理 `queue_updated`。彈幕另由 `useDanmakuFeed` 訂閱同一條 `/ws`，只挑 `danmaku` 訊息轉成前端項目交給 `DanmakuOverlay` 動畫呈現（與佇列狀態互不干擾）：

```jsonc
{
  "type": "danmaku",
  "payload": { "text": "oscar：今天天氣真好" },
}
```

其餘事件型別已保留於協定中，供未來擴充。

## 端到端範例：貼連結點歌

1. 使用者在 Discord 貼 `https://youtu.be/dQw4w9WgXcQ`。
2. `discord-bot` 解析出 `dQw4w9WgXcQ`，`KtvStore.enqueue` 後 `publish` 一則 `QueueUpdated`。
3. `api` 收到事件，直接廣播該 `QueueState`。
4. 大螢幕前端收到 `queue_updated`，`current` 有值即開始播放。
5. 播完時前端呼叫 `POST /playback/ended` → `api` publish `Skip(reason: ended)` → `advance` → 廣播新狀態 → 播下一首。

## 端到端範例：彈幕

1. 使用者在頻道發一句非命令閒聊「今天天氣真好」。
2. `discord-bot` 的 `parseMessage` 判為 `danmaku`（截斷至 80 字），`applyIntent` 組出「暱稱：訊息」並 `publish` 一則 `Danmaku`，不在 Discord 回覆。
3. `api` 收到事件，原樣廣播 `danmaku` 訊息（不動佇列）。
4. 前端 `useDanmakuFeed` 收到後產生一則彈幕，`DanmakuOverlay` 讓它從畫面上方 1/3 由右向左飄約 5 秒後移除。
5. 側邊欄的彈幕開關可切換顯示（狀態存於 localStorage），關閉時不顯示任何彈幕。
