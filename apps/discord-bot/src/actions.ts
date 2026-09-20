import {
  createSong,
  KtvEventType,
  type KtvEvent,
} from '@discord-ktv/shared-types';
import { KtvStore, publishEvent, type Redis } from '@discord-ktv/redis-client';
import { fetchVideoTitle } from '@discord-ktv/youtube-utils';
import type { MessageIntent } from './message-handler';

/**
 * 抓取影片標題的執行器型別；預設用 youtube-utils 的 fetchVideoTitle，
 * 抽成可注入依賴以便測試時不打真正的網路。
 */
export type TitleResolver = (videoId: string) => Promise<string | null>;

/**
 * 依據意圖執行副作用：更新 Redis 佇列狀態並發布事件。
 * 回傳一段給使用者的回覆文字（bot 會在 Discord 回覆），無需回覆時為 null。
 *
 * 設計：所有會改變佇列的操作，最後都 publish QueueUpdated 帶最新完整狀態，
 * 讓 api 訂閱後直接推播給前端；skip/pause/play 另外也 publish 對應語意事件。
 */
export async function applyIntent(
  intent: MessageIntent,
  deps: {
    store: KtvStore;
    pub: Redis;
    requestedBy: string;
    /** 抓標題執行器，預設用 youtube-utils 的 fetchVideoTitle */
    resolveTitle?: TitleResolver;
  }
): Promise<string | null> {
  const { store, pub, requestedBy } = deps;
  const resolveTitle = deps.resolveTitle ?? fetchVideoTitle;

  switch (intent.kind) {
    case 'enqueue': {
      // 盡力抓 YouTube 標題當歌名；失敗回 null，讓前端 fallback 到 videoId
      const title = await resolveTitle(intent.videoId);
      const song = createSong(
        intent.videoId,
        requestedBy,
        title ? { title } : {}
      );
      const state = await store.enqueue(song);
      await publishEvent(pub, {
        type: KtvEventType.QueueUpdated,
        payload: state,
      });
      const position =
        state.current?.id === song.id ? '即將播放' : `第 ${state.items.length} 順位`;
      const label = song.title ?? `videoId=${song.videoId}`;
      return `已點歌 🎵 ${label}（${position}）`;
    }

    case 'skip': {
      const state = await store.advance();
      const events: KtvEvent[] = [
        { type: KtvEventType.Skip, payload: {} },
        { type: KtvEventType.QueueUpdated, payload: state },
      ];
      for (const e of events) await publishEvent(pub, e);
      return '⏭️ 已跳過';
    }

    case 'pause': {
      const state = await store.setPaused(true);
      await publishEvent(pub, { type: KtvEventType.Pause, payload: {} });
      await publishEvent(pub, {
        type: KtvEventType.QueueUpdated,
        payload: state,
      });
      return '⏸️ 已暫停';
    }

    case 'play': {
      const state = await store.setPaused(false);
      await publishEvent(pub, { type: KtvEventType.Play, payload: {} });
      await publishEvent(pub, {
        type: KtvEventType.QueueUpdated,
        payload: state,
      });
      return '▶️ 繼續播放';
    }

    case 'ignore':
    default:
      return null;
  }
}
