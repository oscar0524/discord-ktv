# Discord KTV 🎤

透過 Discord 貼上 YouTube 連結點歌，由單一大螢幕依全域佇列自動播放的 KTV 系統。
以 Nx monorepo 管理，含 Discord bot、Express API、React 前端與共用 libs。

> 主線（Discord 貼連結 → Redis → WebSocket → 大螢幕播放）已可運作，並支援跳過/暫停/繼續、
> 以編號插歌、網頁拖曳重排、彈幕、`help` 說明指令、YouTube 標題抓取，以及可於網頁調整並熱重連的
> Discord 設定。

## 架構

```
Discord ──連結/指令──► discord-bot ──enqueue/publish──► Redis（佇列 + Pub/Sub）
                                                          ▲  │ subscribe
                                                          │  ▼
                              大螢幕 ◄──WebSocket── api（Express + ws）
                                    ──REST 控制/播完──►
```

詳見 [specs/overview.md](./specs/overview.md)。

## 專案結構

```
apps/
  discord-bot/   Discord Gateway：解析連結與指令，更新佇列並發事件
  api/           Express REST + WebSocket，訂閱 Redis 事件並推播；可提供 web 靜態產物
  web/           React + MUI + Tailwind 大螢幕播放器（YouTube iframe，含日夜主題）
libs/
  shared-types/  共用型別與事件協定
  redis-client/  ioredis 連線、佇列存取、Pub/Sub
  youtube-utils/ 從連結解析 video id
docker/          開發用 compose 與集成用 all-in-one Dockerfile
specs/           系統概觀、Redis schema、事件協定、API 介面
```

## 技術選擇

- Monorepo：Nx 20 + npm workspaces
- Bot：discord.js 14（需 Node 20+）
- API：Express 4 + ws（WebSocket）
- 前端：React 18 + Vite 5 + MUI 5 + Tailwind 3（日夜主題）
- 資料/訊息：Redis + ioredis（佇列 + Pub/Sub）

## 環境變數

複製 `.env.example` 為 `.env` 並填入：

| 變數                           | 用途                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `DISCORD_TOKEN`                | Discord bot token（必填，[Developer Portal](https://discord.com/developers/applications)） |
| `DISCORD_KTV_CHANNEL_ID`       | 限制 bot 只回應的頻道 id（可選，留空為全部）                                               |
| `REDIS_URL`                    | Redis 連線字串（預設 `redis://localhost:6379`）                                            |
| `API_PORT`                     | API 埠（預設 `3333`）                                                                      |
| `VITE_API_URL` / `VITE_WS_URL` | 前端連線 API 的 URL                                                                        |
| `WEB_PORT`                     | 前端 dev server 埠（預設 `4200`）                                                          |

## Discord Bot 設定

在 [Developer Portal](https://discord.com/developers/applications) 建立 Application 後，依下列步驟設定並邀請 bot。

### 1. Bot 頁籤 — Privileged Gateway Intents

bot 需讀取訊息內容來解析點歌連結與指令，必須開啟：

- ✅ **Message Content Intent**（必開，否則讀不到訊息內容，點歌無效）

其餘特權 intent（Presence、Server Members）本專案用不到，可維持關閉。

> bot 實際請求的 Gateway Intents 為 `Guilds`、`GuildMessages`、`MessageContent`。
> 前兩者是非特權 intent，不需在 Portal 額外勾選；只有 `MessageContent` 屬特權 intent 需手動開啟。

### 2. 取得 Token

於 **Bot** 頁籤點 **Reset Token** 取得，填入 `.env` 的 `DISCORD_TOKEN`（或啟動後於網頁「Discord 設定」填入）。

### 3. OAuth2 — 邀請 bot 進伺服器

到 **OAuth2 → URL Generator**：

- **Scopes**：勾選 `bot`
- **Bot Permissions**：至少勾選
  - ✅ **View Channels**（讀取頻道）
  - ✅ **Send Messages**（回覆點歌結果）
  - ✅ **Read Message History**（讀取訊息內容）

用產生的 URL 邀請 bot 進伺服器即可。若有用 `DISCORD_KTV_CHANNEL_ID` 限制頻道，確認 bot 在該頻道有上述權限。

## 本機開發

需要一個 Redis。若要在容器重啟後保留佇列資料，掛一個 volume 到 `/data` 並開啟 append-only 持久化：

```bash
docker run -d --name ktv-redis \
  -p 6379:6379 \
  -v ktv-redis-data:/data \
  redis:7-alpine redis-server --appendonly yes
```

> `-v ktv-redis-data:/data` 用具名 volume 保存資料，實際儲存位置由 Docker 管理，不需指定本機路徑。
> `--appendonly yes` 開啟 AOF 持久化，寫入會逐筆落盤（比預設的 RDB snapshot 更不易掉資料）。

```bash
npm install

# 分別在不同終端機啟動
npm run serve:api    # Express + WebSocket，http://localhost:3333
npm run serve:web    # Vite 前端，http://localhost:4200
npm run serve:bot    # Discord bot（需先設定 DISCORD_TOKEN）
```

## 用 docker-compose 開發（含 Redis）

一鍵拉起 redis + bot + api + web，原始碼掛載支援熱重載：

```bash
cp .env.example .env   # 填入 DISCORD_TOKEN
docker compose -f docker/docker-compose.yml up
```

前端：<http://localhost:4200>　API：<http://localhost:3333>

## 集成部署（all-in-one 單一 image）

把 Redis、bot、api 與 web 產物打包進一個 image，用 supervisord 一起跑，
web 由 api 以 Express static 提供：

```bash
docker build -f docker/Dockerfile -t discord-ktv .
docker run --rm -p 3333:3333 -v ktv_redis:/data -e DISCORD_TOKEN=your-token discord-ktv
# 打開 http://localhost:3333
```

> `-v ktv_redis:/data` 用具名 volume 保存內建 Redis 的資料（AOF 持久化），
> 佇列與 Discord 設定可跨容器重啟/重建保存。即使帶 `--rm`，volume 裡的資料也不會被刪。

## 測試與建置

```bash
npm test         # 跑所有專案的單元測試
npm run build    # 建置所有 app（產物在 dist/apps/*）
npm run graph    # 開啟 Nx 專案依賴圖

# 單一專案
npx nx test youtube-utils
npx nx build api
```

## 文件

- [系統概觀](./specs/overview.md)
- [Redis 資料結構](./specs/redis-schema.md)
- [事件與 WebSocket 協定](./specs/events.md)
- [API 介面](./specs/api.md)
