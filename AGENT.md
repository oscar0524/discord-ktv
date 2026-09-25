# AGENT.md

給 AI agent 與開發者的專案指南。閱讀本檔即可掌握 Discord KTV 專案的架構、慣例、指令與已知陷阱。

## 專案簡介

透過 Discord 貼上 YouTube 連結點歌，由單一大螢幕依全域佇列自動播放的 KTV 系統。
以 Nx monorepo 管理，目前為**基礎框架**：主線（Discord 貼連結 → Redis → WebSocket → 大螢幕播放）可運作，各元件為可啟動的骨架。

資料流原則：所有佇列變動的意圖都以「publish 事件到 Redis」表達，由 `api` 的訂閱端統一套用到佇列狀態後，把完整 `QueueState` 透過 WebSocket 廣播給前端。前端永遠收到完整最新狀態，不自行推導。

## 架構

```
Discord ──連結/指令──► discord-bot ──enqueue/publish──► Redis（佇列 + Pub/Sub）
                                                          ▲  │ subscribe
                                                          │  ▼
                              大螢幕 ◄──WebSocket── api（Express + ws）
                                    ──REST 控制/播完──►
```

## 目錄結構

```
apps/
  discord-bot/   discord.js Gateway：解析連結與指令，更新佇列並發事件
  api/           Express REST + WebSocket，訂閱 Redis 事件並推播；可提供 web 靜態產物
  web/           React + MUI + Tailwind 大螢幕播放器（YouTube iframe，日夜主題）
libs/
  shared-types/  共用型別與事件協定（單一事實來源）
  redis-client/  ioredis 連線、佇列存取（KtvStore）、Pub/Sub
  youtube-utils/ 從連結解析 video id
docker/          開發用 compose 與集成用 all-in-one Dockerfile
specs/           系統概觀、Redis schema、事件協定、API 介面
```

## 技術選擇

- Monorepo：Nx 20 + npm workspaces（`apps/*`、`libs/*`）
- 語言/編譯：TypeScript 5.6，`tsconfig.base.json` 為 `module=commonjs` / `moduleResolution=node`
- Bot：discord.js 14（需 Node 20+）
- API：Express 4 + ws（WebSocket）
- 前端：React 18 + Vite 5 + MUI 5 + Tailwind 3（日夜主題）
- 資料/訊息：Redis + ioredis（佇列 + Pub/Sub）
- 測試：Jest + ts-jest（web 用 jsdom + Testing Library）

## 常用指令

```bash
npm install                 # 安裝依賴
npm test                    # 跑所有專案測試（nx run-many -t test）
npm run build               # 建置所有 app（產物在 dist/apps/*）
npm run graph               # Nx 專案依賴圖

# 開發（各自一個終端；需要 Redis 在 localhost:6379）
npm run serve:api           # http://localhost:3333
npm run serve:web           # http://localhost:4200
npm run serve:bot           # 需先設定 DISCORD_TOKEN

# 單一專案
npx nx test youtube-utils
npx nx build api
npx nx typecheck redis-client

# Docker
docker compose -f docker/docker-compose.yml up            # 開發環境（含 Redis）
docker build -f docker/Dockerfile -t discord-ktv .        # all-in-one 集成 image
docker run --rm -p 3333:3333 -e DISCORD_TOKEN=xxx discord-ktv
```

## 專案慣例（新增 app/lib 時遵循）

### Path alias

跨專案 import 一律用 `@discord-ktv/<name>`（定義於 `tsconfig.base.json` 的 `paths`，指向各 lib 的 `src/index.ts`）。

### 每個專案的檔案樣板

- `package.json`：lib 設 `"main"`/`"types"` 指向 `./src/index.ts`。
- `project.json`：定義 `build` / `serve` / `typecheck` / `test` targets，用 `nx:run-commands` executor。
  - ⚠️ **不要**加 `"$schema": "...node_modules/nx/schemas/..."`，指向可遠端解析的 schema 會被工具擋下。
- `tsconfig.json`：app 與「有跨 lib import」的 lib 用 `"noEmit": true`（見下方陷阱）。
- `tsconfig.spec.json`：測試用，`types` 含 `jest`/`node`（web 另加 `@testing-library/jest-dom`）。
- `jest.config.ts`：`preset: '../../jest.preset.js'`（web 因 jsdom + import.meta 需求另做自訂設定）。

### 建置方式

- **node app（api / discord-bot）**：`build` 用 `nx:run-commands` 跑 `esbuild ... --bundle --tsconfig=... --outfile=dist/apps/<app>/main.js`。esbuild 靠 `--tsconfig` 自動解析 path alias。**未安裝 `@nx/esbuild` plugin**，直接用 esbuild CLI（已列為 devDep）。
- **web**：`vite build`，輸出到 `dist/apps/web`。
- **lib**：`build` 用 `tsc -p .../tsconfig.json`（`^build` 依賴會先建 libs）。
- `serve`（node app）：`node -r ts-node/register -r tsconfig-paths/register .../main.ts`（`tsconfig-paths` 於 runtime 解析 alias）。

### 測試慣例

- 邏輯與副作用分離：把純函式（如 `parseMessage`）與可注入依賴的執行器（如 `applyIntent`、`handleEvent`）抽出來測，不依賴真實 Discord/網路。
- Redis 測試用 `ioredis-mock`：
  - ⚠️ 不同 `new RedisMock()` 實例**共享同一份記憶體資料集**，測試間需 `beforeEach` 呼叫 `flushall` 清空。
  - Pub/Sub 測試用**兩個獨立實例**當 publisher / subscriber（它們共享 pub/sub bus）。
- api 用 supertest 測 REST；`main.ts` 以 `require.main === module` 守衛，讓測試可 import `handleEvent` 而不啟動 server。

## 已知陷阱（踩過的坑）

1. **跨 lib import 撞 `rootDir`**：若 lib 的 tsconfig 同時設 `rootDir: ./src` 又 import 其他 lib 的 source alias，tsc 會報「file is not under rootDir」。解法：有跨 lib import 的專案（redis-client、所有 app）tsconfig 用 `"noEmit": true` 且不設 `rootDir`；建置交給 esbuild/vite bundle。純葉子 lib（shared-types、youtube-utils）可保留 `rootDir`+`outDir`。

2. **web 的 `import.meta.env` 與 Jest（CJS）衝突**：ts-jest 以 CJS 轉譯無法解析 `import.meta`。解法：把 env 讀取集中在 `apps/web/src/api/env.ts`，並在 `jest.config.ts` 用 `moduleNameMapper` 導向 `src/api/__mocks__/env.ts`。

3. **MUI + Tailwind 樣式衝突**：Tailwind 在 `tailwind.config.js` 關閉 `preflight`（`corePlugins.preflight = false`），避免覆蓋 MUI 基礎樣式。日夜主題由 `ThemeContext` 同步 MUI `palette.mode` 與 `<html>` 的 `dark` class。

4. **Docker `npm ci` lockfile 不同步**：`node:20` image 內建 npm 10，與較新的本機 npm（11）計算 lockfile 的方式不同，會把某些 optional peer deps（如 `babel-plugin-macros`）判為 missing。解法：Dockerfile build 階段先 `RUN npm install -g npm@11` 對齊；修改依賴後務必本機跑 `npm install` 更新 lockfile。

5. **Discord Message Content Intent**：bot 需在 Developer Portal 開啟 Message Content Intent 才讀得到訊息內容，程式已宣告該 intent。

## 環境變數

見 `.env.example`。關鍵：`DISCORD_TOKEN`、`REDIS_URL`、`API_PORT`、`VITE_API_URL`/`VITE_WS_URL`。

`DISCORD_TOKEN` / `DISCORD_KTV_CHANNEL_ID` 現為**初始種子**：bot 以 Redis（`ktv:config:discord`）
為單一事實來源，啟動時若 Redis 尚無 token 但 env 有值，會把 env 寫入 Redis 當初始值。
之後可於網頁（右側欄「Discord 設定」）變更，bot 在同一 process 熱重連（不需重啟）。
缺 token 時 bot 待命不結束，等待網頁設定後自動連線。

## Redis / 事件協定速查

- Key：
  - `ktv:queue:state`（String，序列化的 `QueueState`）
  - `ktv:config:discord`（String，序列化的 `DiscordConfig`＝`{ token, channelId }`；經 `ConfigStore` 讀寫）
- Channel：`ktv:events`（序列化的 `KtvEvent`）
- 事件型別：`QueueUpdated` / `Skip` / `Pause` / `Play` / `ConfigUpdated`（見 `libs/shared-types`）
- api 介面：`GET /config/discord`（遮罩狀態，不回明文 token）、`PUT /config/discord`（更新後 publish `ConfigUpdated`）
- 詳見 `specs/redis-schema.md`、`specs/events.md`、`specs/api.md`

## 給 AI agent 的提醒

- 修改型別先改 `libs/shared-types`，它是 Redis 資料、事件、WebSocket 訊息的單一事實來源。
- 動到依賴後，記得本機 `npm install` 同步 lockfile，否則 Docker build 會失敗。
- 新增功能時沿用「純函式 + 可注入依賴」的分離方式，維持可測試性。
- 驗證改動：至少跑 `npm test`；動到 build 相關再跑 `npm run build`。
