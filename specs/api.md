# API 介面（REST + WebSocket）

實作見 `apps/api/src/app.ts` 與 `apps/api/src/main.ts`。
預設埠：`API_PORT`（預設 `3333`）。REST 與 WebSocket 共用同一個 port。

## REST

| Method | Path              | 說明                                   | 回應                                                   |
| ------ | ----------------- | -------------------------------------- | ------------------------------------------------------ |
| GET    | `/health`         | 健康檢查                               | `{ "status": "ok" }`                                   |
| GET    | `/queue`          | 取得目前佇列狀態                       | `QueueState`                                           |
| POST   | `/control/skip`   | 跳過目前歌曲                           | `{ "ok": true }`                                       |
| POST   | `/control/pause`  | 暫停                                   | `{ "ok": true }`                                       |
| POST   | `/control/play`   | 繼續                                   | `{ "ok": true }`                                       |
| POST   | `/playback/ended` | 大螢幕播完一首，推進下一首             | `{ "ok": true }`                                       |
| GET    | `/config/discord` | 取得 Discord 設定的遮罩狀態            | `{ "hasToken": boolean, "channelId": string \| null }` |
| PUT    | `/config/discord` | 更新 Discord 設定（token / channelId） | `{ "hasToken": boolean, "channelId": string \| null }` |

控制端點只負責「發布事件」到 Redis；實際佇列變動由 `api` 的訂閱端統一處理（見
[events.md](./events.md)），維持單一資料流方向。

### `/config/discord` 說明

- `GET` 一律遮罩：只回 `hasToken`（是否已設定 token）與 `channelId`，**不回傳明文 token**。
- `PUT` body：`{ token?: string, channelId?: string | null }`
  - `token` 省略表示不變更（保留 Redis 既有值）；提供時須為非空字串，否則回 `400`。
  - `channelId` 省略表示不變更；提供時須為純數字字串或空字串/`null`（空字串視為清除為 `null`），否則回 `400`。
  - 成功後寫入 Redis（`ktv:config:discord`）並 publish `ConfigUpdated`（不帶明文 token），
    bot 收到後從 Redis 重讀並在同一 process 熱重連。

### 範例

```bash
curl http://localhost:3333/queue
curl -X POST http://localhost:3333/control/skip
curl -X POST http://localhost:3333/playback/ended

# 讀取 Discord 設定遮罩狀態
curl http://localhost:3333/config/discord
# 更新 token 與頻道
curl -X PUT http://localhost:3333/config/discord \
  -H 'Content-Type: application/json' \
  -d '{"token":"your-bot-token","channelId":"123456789"}'
# 只改頻道、保留 token
curl -X PUT http://localhost:3333/config/discord \
  -H 'Content-Type: application/json' \
  -d '{"channelId":"987654321"}'
```

## WebSocket

- 路徑：`/ws`（例：`ws://localhost:3333/ws`）
- 連線建立後立即收到一則目前狀態的 `queue_updated`。
- 之後每當佇列變動收到 `queue_updated`（`ServerMessage`）。

訊息格式與事件語意見 [events.md](./events.md)。

## 靜態檔（all-in-one 模式）

當 `api` 偵測到同層存在 web 產物目錄（`__dirname/../web`）時，會以 Express static 提供前端，
並對非 API 路徑做 SPA fallback 到 `index.html`。開發模式下 web 由 Vite dev server 獨立提供，
此時 `api` 不掛載 static。
