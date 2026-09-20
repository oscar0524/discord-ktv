import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { Song } from '@discord-ktv/shared-types';
import { api } from '../api/client';

/**
 * YouTube 播放器。使用 IFrame Player API 以取得「播放結束」事件，
 * 播完後呼叫 api.playbackEnded() 讓後端推進佇列（自動下一首）。
 *
 * 為維持骨架階段簡單，若 YT API 尚未載入，仍會以 iframe 顯示影片，
 * onEnd 綁定則於 API ready 後補上。
 */

// 最小化的 YT 型別宣告（避免額外安裝 @types）
interface YTPlayer {
  destroy(): void;
  pauseVideo(): void;
  playVideo(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      events?: { onStateChange?: (e: { data: number }) => void };
      playerVars?: Record<string, number>;
    }
  ) => YTPlayer;
  PlayerState: { ENDED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_API_SRC = 'https://www.youtube.com/iframe_api';

function ensureYouTubeApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.querySelector(`script[src="${YT_API_SRC}"]`)) {
      const tag = document.createElement('script');
      tag.src = YT_API_SRC;
      document.head.appendChild(tag);
    }
  });
}

export function Player({
  current,
  isPaused = false,
}: {
  current: Song | null;
  isPaused?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  // 以 ref 保存最新的 isPaused，讓 player 建立當下能套用初始暫停狀態，
  // 又不需把 isPaused 放進「重建 player」的依賴陣列。
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!current || !hostRef.current) return;
    let cancelled = false;
    const host = hostRef.current;

    void ensureYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current?.destroy();
      const mount = document.createElement('div');
      host.innerHTML = '';
      host.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        videoId: current.videoId,
        // cc_load_policy: 0 → 不預設開啟字幕（CC）。
        playerVars: { autoplay: 1, cc_load_policy: 0 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              void api.playbackEnded();
            }
          },
        },
      });
      // 若換歌當下已是暫停狀態，套用到剛建立的 player。
      if (isPausedRef.current) {
        playerRef.current.pauseVideo();
      }
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // 只在「播放中的影片」真的換了才重建播放器。
    // 佇列變動會產生全新的 QueueState/current 物件參考，但 videoId 不變，
    // 若把整個 current 放進依賴會導致每次排歌都重建 player → 影片重播。
  }, [current?.videoId]);

  // 將 isPaused 套用到實際的 YouTube 播放器。
  // 獨立於「重建 player」的 effect，避免暫停/繼續時重建播放器導致影片重播。
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPaused) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [isPaused]);

  if (!current) {
    return (
      <Box
        className="flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5"
        sx={{ aspectRatio: '16 / 9', width: '100%' }}
        data-testid="player-empty"
      >
        <Typography variant="h5" color="text.secondary">
          🎤 等待點歌中…
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={hostRef}
      data-testid="player"
      data-video-id={current.videoId}
      sx={{ aspectRatio: '16 / 9', width: '100%', '& iframe': { width: '100%', height: '100%' } }}
      className="overflow-hidden rounded-lg bg-black"
    />
  );
}
