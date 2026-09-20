# Discord KTV 系統概觀

透過 Discord 貼上 YouTube 連結點歌，由單一大螢幕依全域佇列自動播放的 KTV 系統。

## 目標與範圍

- 使用者在 Discord 頻道貼 YouTube 連結即完成點歌（不需 YouTube Data API key，直接解析 video id）。
- 一台大螢幕開著 web 播放器，依「單一全域佇列」自動播放下一首。
- 播放控制三種來源皆支援：
  - 播完自動下一首（前端偵測播放結束）
  - Discord 指令（跳過 / 暫停 / 繼續）
  - 網頁按鈕（跳過 / 暫停 / 繼續）
- 佇列變動透過 Redis Pub/Sub 即時推播，API 以 WebSocket 推到前端。

## 架構

```
Discord 使用者
   │  貼 YouTube 連結 / 跳過·暫停指令
   ▼
apps/discord-bot ──(解析 videoId, enqueue, PUBLISH 事件)──► Redis（佇列 + Pub/Sub）
                                                              ▲   │ SUBSCRIBE
                                              讀寫佇列 / publish │   ▼
                                                        apps/api（Express + WebSocket）
                                                              ▲   │ WebSocket 推播最新 QueueState
                                            REST 控制 / 播完通知 │   ▼
                                                        apps/web（React + YouTube iframe）──► 大螢幕
```

## 元件職責

| 元件 | 職責 |
| --- | --- |
| `apps/discord-bot` | 維持 Discord Gateway 連線，解析訊息中的 YouTube 連結與控制指令，更新 Redis 佇列並發布事件。 |
| `apps/api` | 提供 REST 控制端點與 WebSocket 推播；訂閱 Redis 事件，統一收斂佇列變動後廣播最新狀態；all-in-one 模式下以 Express static 提供 web 產物。 |
| `apps/web` | KTV 大螢幕播放器（YouTube iframe），顯示待播清單、控制按鈕、日夜主題切換；播完通知 API 推進佇列。 |
| `libs/shared-types` | 共用型別與事件協定（`Song`、`QueueState`、`KtvEventType`）。 |
| `libs/redis-client` | ioredis 連線工廠、佇列存取（`KtvStore`）、Pub/Sub 封裝。 |
| `libs/youtube-utils` | 從 YouTube 連結解析 video id。 |

## 資料流的關鍵原則

佇列的實際變動（enqueue、advance、暫停旗標）集中在少數地方發生，避免多寫入者競態：

- `discord-bot` 負責 enqueue，並在 enqueue 後 publish `QueueUpdated`（帶最新完整狀態）。
- 所有控制（skip / pause / play / 播完）都以「發布事件」表達意圖。
- `api` 訂閱事件後統一套用到佇列狀態（skip→advance、pause/play→setPaused），再把最新 `QueueState` 廣播給所有前端。

如此前端永遠收到「完整的最新狀態」，不需在客戶端自行推導。

## 相關文件

- 資料結構與 key/channel 命名：[redis-schema.md](./redis-schema.md)
- 事件與 WebSocket 訊息協定：[events.md](./events.md)
- REST 與 WebSocket 介面：[api.md](./api.md)
