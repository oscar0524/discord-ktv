#!/usr/bin/env bash
#
# 建置 discord-ktv all-in-one Docker image。
#
# 預設目標平台為 linux/amd64（x86 伺服器），即使在 Apple Silicon Mac 上
# build 也會產出 x86 image，可直接丟到 x86 機器跑。
#
# 用法：
#   scripts/docker-build.sh                      # build linux/amd64，載入本機（--load）
#   PLATFORM=linux/arm64 scripts/docker-build.sh # 改 build arm64
#   PLATFORM=linux/amd64,linux/arm64 PUSH=1 IMAGE=registry.example.com/discord-ktv:latest \
#     scripts/docker-build.sh                    # 多架構並推到 registry
#
# 環境變數：
#   IMAGE     image 名稱與 tag（預設 discord-ktv:latest）
#   PLATFORM  目標平台（預設 linux/amd64；多架構用逗號分隔）
#   PUSH      設為 1 時推到 registry（--push），否則載入本機（--load）
#
set -euo pipefail

# 切到專案根目錄（此腳本位於 <root>/scripts）
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE="${IMAGE:-discord-ktv:latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-0}"
DOCKERFILE="docker/Dockerfile"

# 多架構（platform 含逗號）只能配合 --push，無法 --load 到本機
if [[ "$PLATFORM" == *","* && "$PUSH" != "1" ]]; then
  echo "錯誤：多架構建置（PLATFORM=${PLATFORM}）必須設定 PUSH=1 並指定 registry 的 IMAGE。" >&2
  echo "      例如：PLATFORM=${PLATFORM} PUSH=1 IMAGE=registry/discord-ktv:latest ${0}" >&2
  exit 1
fi

if [[ "$PUSH" == "1" ]]; then
  OUTPUT_FLAG="--push"
else
  OUTPUT_FLAG="--load"
fi

echo "==> 建置 image：${IMAGE}"
echo "==> 目標平台：${PLATFORM}"
echo "==> 輸出方式：${OUTPUT_FLAG}"

# 確保有可用的 buildx builder（跨平台建置需要）
if ! docker buildx inspect discord-ktv-builder >/dev/null 2>&1; then
  echo "==> 建立 buildx builder：discord-ktv-builder"
  docker buildx create --name discord-ktv-builder --use >/dev/null
else
  docker buildx use discord-ktv-builder
fi

docker buildx build \
  --platform "$PLATFORM" \
  -f "$DOCKERFILE" \
  -t "$IMAGE" \
  "$OUTPUT_FLAG" \
  .

echo "==> 完成：${IMAGE} (${PLATFORM})"
