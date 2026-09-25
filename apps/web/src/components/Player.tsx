import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import type { Song } from '@discord-ktv/shared-types';
import { api } from '../api/client';
import { useYouTubeApi } from '../youtube/YouTubeApiContext';

/**
 * YouTube 播放器。使用官方 IFrame Player API（YT.Player）：
 * API 的載入/就緒由 <YouTubeApiProvider> 負責，本元件透過 useYouTubeApi()
 * 取得就緒的 YT 物件後才建立 player（未就緒時顯示等待畫面）。
 * 播完後呼叫 api.playbackEnded() 讓後端推進佇列（自動下一首）。
 */

export function Player({
  current,
  isPaused = false,
}: {
  current: Song | null;
  isPaused?: boolean;
}) {
  const YT = useYouTubeApi();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  // 以 ref 保存最新的 isPaused，讓 player 建立當下能套用初始暫停狀態，
  // 又不需把 isPaused 放進「建立 player」的依賴陣列。
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    // YT 未就緒（API 尚未載入）或無 current 時不建 player。
    if (!YT || !current || !hostRef.current) return;
    const host = hostRef.current;

    // 已有 player：重用實例，只換影片。
    if (playerRef.current) {
      playerRef.current.loadVideoById(current.videoId);
      return;
    }

    // 首次建立：官方 API 會「取代」傳入的元素本身成為 iframe，
    // 因此建立一個新的 mount 元素交給 YT.Player（而非掛在其內）。
    const mount = document.createElement('div');
    host.innerHTML = '';
    host.appendChild(mount);

    // 省略 cc_load_policy 即為 API 預設「不預設開啟字幕」。
    const player = new YT.Player(mount, {
      videoId: current.videoId,
      playerVars: { autoplay: 1 },
      events: {
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            void api.playbackEnded();
          }
        },
      },
    });
    playerRef.current = player;

    // 若建立當下已是暫停狀態，套用到剛建立的 player。
    if (isPausedRef.current) {
      player.pauseVideo();
    }

    return () => {
      player.destroy();
      playerRef.current = null;
    };
    // 只在「播放中的影片」真的換了（或 YT 由未就緒轉為就緒）才處理。
    // 佇列變動會產生全新的 QueueState/current 物件參考，但 videoId 不變，
    // 若把整個 current 放進依賴會導致每次排歌都重跑此 effect。
  }, [YT, current?.videoId]);

  // 將 isPaused 套用到實際的 YouTube 播放器。
  // 獨立於「建立 player」的 effect，避免暫停/繼續時重建播放器導致影片重播。
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPaused) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [isPaused]);

  // current 為 null，或 API 尚未就緒時，顯示等待畫面（不建 player）。
  if (!current || !YT) {
    return (
      <Box
        className="flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5"
        sx={{ aspectRatio: '16 / 9', width: '100%' }}
        data-testid="player-empty"
      >
        <Typography variant="h5" color="text.secondary">
          {current ? '🎤 播放器載入中…' : '🎤 等待點歌中…'}
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
