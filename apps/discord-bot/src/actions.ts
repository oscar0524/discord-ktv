import {
  createSong,
  KtvEventType,
  type KtvEvent,
} from '@discord-ktv/shared-types';
import { KtvStore, publishEvent, type Redis } from '@discord-ktv/redis-client';
import type { MessageIntent } from './message-handler';

/**
 * 依據意圖執行副作用：更新 Redis 佇列狀態並發布事件。
 * 回傳一段給使用者的回覆文字（bot 會在 Discord 回覆），無需回覆時為 null。
 *
 * 設計：所有會改變佇列的操作，最後都 publish QueueUpdated 帶最新完整狀態，
 * 讓 api 訂閱後直接推播給前端；skip/pause/play 另外也 publish 對應語意事件。
 */
export async function applyIntent(
  intent: MessageIntent,
  deps: { store: KtvStore; pub: Redis; requestedBy: string }
): Promise<string | null> {
  const { store, pub, requestedBy } = deps;

  switch (intent.kind) {
    case 'enqueue': {
      const song = createSong(intent.videoId, requestedBy);
      const state = await store.enqueue(song);
      await publishEvent(pub, {
        type: KtvEventType.QueueUpdated,
        payload: state,
      });
      const position =
        state.current?.id === song.id ? '即將播放' : `第 ${state.items.length} 順位`;
      return `已點歌 🎵 videoId=${song.videoId}（${position}）`;
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
