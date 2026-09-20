# Discord KTV 專案慣例

本檔為 always-included steering，供 Kiro 每次互動自動載入專案的核心慣例。
完整指南見下方引用的 AGENT.md。

## 核心原則

- **型別單一事實來源**：`Song` / `QueueState` / `KtvEventType` 等型別一律定義在 `libs/shared-types`，修改型別先改這裡。
- **資料流方向**：佇列變動的意圖以「publish 事件到 Redis」表達，由 `api` 訂閱端統一套用並廣播完整 `QueueState` 給前端。不要在多處直接寫佇列狀態。
- **邏輯與副作用分離**：把純函式與可注入依賴的執行器抽出來，維持可測試性（例如 `parseMessage` / `applyIntent` / `handleEvent`）。

## 硬性慣例

- 跨專案 import 一律用 `@discord-ktv/<name>` alias（定義於 `tsconfig.base.json`）。
- 新增 `project.json` **不要**加指向 node_modules 的 `$schema` 欄位（會被工具擋）。
- 有跨 lib import 的專案（apps、redis-client）tsconfig 用 `"noEmit": true`、不設 `rootDir`；建置交給 esbuild（node app）或 vite（web）。純葉子 lib 才用 `rootDir`+`outDir`+`tsc`。
- Redis 測試用 `ioredis-mock`：`beforeEach` 要 `flushall`（實例共享記憶體）；pub/sub 測試用兩個獨立實例。
- 動到依賴後務必本機 `npm install` 同步 lockfile，否則 Docker `npm ci` 會失敗。

## 驗證

- 任何改動至少跑 `npm test`；動到建置相關再跑 `npm run build`。

## 完整指南

#[[file:AGENT.md]]
