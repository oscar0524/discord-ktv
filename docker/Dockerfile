# ---- all-in-one 集成映像 ----
# 單一 image 內含 redis + api + discord-bot + web 產物（web 由 api 以 Express static 提供），
# 用 supervisord 同時拉起。適合單機/小型 KTV 部署，一個 docker run 即跑起整套系統。
#
# 建置（在專案根目錄）：
#   docker build -f docker/Dockerfile -t discord-ktv .
# 執行：
#   docker run --rm -p 3333:3333 -e DISCORD_TOKEN=xxx discord-ktv
#   打開 http://localhost:3333

# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /workspace

# 對齊本機 npm 版本，避免 lockfile 因 npm 主版本差異被判定 out-of-sync
RUN npm install -g npm@11

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 產出三個 app 的產物：
# - api / discord-bot：esbuild bundle 成單一 main.js
# - web：vite build 靜態產物
RUN npx nx build api \
  && npx nx build discord-bot \
  && npx nx build web

# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# 安裝 redis-server 與 supervisor
RUN apt-get update \
  && apt-get install -y --no-install-recommends redis-server supervisor \
  && rm -rf /var/lib/apt/lists/*

# 複製各 app 產物到固定位置：
# /app/api/main.js、/app/discord-bot/main.js、/app/web/(靜態檔)
# api 以 path.resolve(__dirname, '../web') 找 web 產物，故 web 需與 api 同層。
COPY --from=build /workspace/dist/apps/api /app/api
COPY --from=build /workspace/dist/apps/discord-bot /app/discord-bot
COPY --from=build /workspace/dist/apps/web /app/web

COPY docker/supervisord.conf /etc/supervisor/conf.d/discord-ktv.conf

ENV NODE_ENV=production \
    REDIS_URL=redis://127.0.0.1:6379 \
    API_PORT=3333

EXPOSE 3333

# 健康檢查：API 的 /health
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3333/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/discord-ktv.conf"]
