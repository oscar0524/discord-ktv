import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { Song } from '@discord-ktv/shared-types';
import YouTubePlayer from 'youtube-player';
import type { YouTubePlayer as YouTubePlayerInstance } from 'youtube-player/dist/types';
import { api } from '../api/client';

/**
 * YouTube 播放器。使用 youtube-player 套件封裝 IFrame Player API：
 * 由套件負責載入 API、註冊 onYouTubeIframeAPIReady、並在 player ready 前排入呼叫。
 * 播完後呼叫 api.playbackEnded() 讓後端推進佇列（自動下一首）。
 */

// PlayerState.ENDED（影片播畢）。對應 YT.PlayerState.ENDED === 0。
const PLAYER_STATE_ENDED = 0;

export function Player({
  current,
  isPaused = false,
}: {
  current: Song | null;
  isPaused?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  // 以 ref 保存最新的 isPaused，讓 player 建立當下能套用初始暫停狀態，
  // 又不需把 isPaused 放進「建立 player」的依賴陣列。
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!current || !hostRef.current) return;
    const host = hostRef.current;

    // 已有 player：重用實例，只換影片（套件會排隊呼叫直到 ready）。
    if (playerRef.current) {
      void playerRef.current.loadVideoById(current.videoId);
      return;
    }

    // 首次建立：掛載到 host 內的新 div。
    const mount = document.createElement('div');
    host.innerHTML = '';
    host.appendChild(mount);

    // 注意：cc_load_policy 型別僅接受 1（開啟字幕）。省略此鍵即為
    // API 預設「不預設開啟字幕」，等同於舊碼的 cc_load_policy: 0。
    const player = YouTubePlayer(mount, {
      videoId: current.videoId,
      playerVars: { autoplay: 1 },
    });
    playerRef.current = player;

    player.on('stateChange', (event) => {
      if (event.data === PLAYER_STATE_ENDED) {
        void api.playbackEnded();
      }
    });

    // 若建立當下已是暫停狀態，套用到剛建立的 player。
    if (isPausedRef.current) {
      void player.pauseVideo();
    }

    return () => {
      void player.destroy();
      playerRef.current = null;
    };
    // 只在「播放中的影片」真的換了才處理。
    // 佇列變動會產生全新的 QueueState/current 物件參考，但 videoId 不變，
    // 若把整個 current 放進依賴會導致每次排歌都重跑此 effect。
  }, [current?.videoId]);

  // 將 isPaused 套用到實際的 YouTube 播放器。
  // 獨立於「建立 player」的 effect，避免暫停/繼續時重建播放器導致影片重播。
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPaused) {
      void player.pauseVideo();
    } else {
      void player.playVideo();
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
