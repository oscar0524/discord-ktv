import {
  createSong,
  KtvEventType,
  type KtvEvent,
  type QueueState,
  type Song,
} from '@discord-ktv/shared-types';
import { KtvStore, publishEvent, type Redis } from '@discord-ktv/redis-client';
import { fetchVideoTitle } from '@discord-ktv/youtube-utils';
import {
  COMMAND_PREFIXES,
  HELP_WORDS,
  LIST_WORDS,
  MOVE_FRONT_WORDS,
  PAUSE_WORDS,
  PLAY_WORDS,
  SKIP_WORDS,
  type MessageIntent,
} from './message-handler';

/** 顯示一首歌用的名稱：優先歌名，否則以 videoId 表示 */
function songLabel(song: Song): string {
  return song.title ?? `videoId=${song.videoId}`;
}

/**
 * 純函式：把佇列狀態格式化為「下 N 首」清單文字（預設 10 首）。
 * 每列含編號、歌名、點歌者、順位；清單空時回友善訊息。
 */
export function formatQueueList(state: QueueState, limit = 10): string {
  const upcoming = state.items.slice(0, limit);
  const lines: string[] = [];
  if (state.current) {
    lines.push(
      `🎶 播放中：${songLabel(state.current)}（編號 ${state.current.songNumber}）`
    );
  }
  if (upcoming.length === 0) {
    lines.push('（待播清單是空的，貼 YouTube 連結來點歌吧）');
    return lines.join('\n');
  }
  lines.push(`📋 接下來 ${upcoming.length} 首：`);
  upcoming.forEach((song, i) => {
    lines.push(
      `${i + 1}. 編號 ${song.songNumber}｜${songLabel(song)}｜點歌：${song.requestedBy}`
    );
  });
  return lines.join('\n');
}

/** 主前綴（用於說明示範，取第一個支援的前綴）。 */
const PRIMARY_PREFIX = COMMAND_PREFIXES[0];

/**
 * 把關鍵字陣列格式化為帶前綴的說明用顯示字串（例：`!跳過 / !skip`）。
 * 依新規則所有控制指令都需帶前綴，故顯示時逐一補上主前綴。
 */
function joinWords(words: string[]): string {
  return words.map((w) => `${PRIMARY_PREFIX}${w}`).join(' / ');
}

/**
 * 純函式：產生一份涵蓋所有指令的說明文字（含 emoji），
 * 風格與 formatQueueList 一致。關鍵字直接引用 message-handler 的常數，
 * 避免硬編兩份而失去同步。
 */
export function formatHelp(): string {
  const prefixes = COMMAND_PREFIXES.join(' 或 ');
  return [
    '🎤 Discord KTV 使用說明',
    '',
    `📌 控制指令需以 ${prefixes} 開頭才生效（點歌免前綴）。`,
    '',
    `🎵 點歌：直接貼上 YouTube 連結（例：https://youtu.be/dQw4w9WgXcQ）`,
    `⏭️ 跳過：${joinWords(SKIP_WORDS)}`,
    `⏸️ 暫停：${joinWords(PAUSE_WORDS)}`,
    `▶️ 繼續：${joinWords(PLAY_WORDS)}`,
    `📋 清單：${joinWords(LIST_WORDS)}`,
    `⏫ 插歌：${joinWords(MOVE_FRONT_WORDS)} <4位編號>（例：${PRIMARY_PREFIX}front 1234）`,
    `❓ 說明：${joinWords(HELP_WORDS)}`,
    '',
    '💬 其他任何文字都會變成彈幕，飄過大螢幕。',
  ].join('\n');
}

/**
 * 抓取影片標題的執行器型別；預設用 youtube-utils 的 fetchVideoTitle，
 * 抽成可注入依賴以便測試時不打真正的網路。
 */
export type TitleResolver = (videoId: string) => Promise<string | null>;

/** 發布一則彈幕事件（讓 enqueue / move_front 等動作也在大螢幕飄字通知） */
async function publishDanmaku(pub: Redis, text: string): Promise<void> {
  await publishEvent(pub, {
    type: KtvEventType.Danmaku,
    payload: { text },
  });
}

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
      // enqueue 由 store 配發 songNumber，需從最新狀態取回這首歌以取得編號
      const stored =
        state.current?.id === song.id
          ? state.current
          : state.items.find((s) => s.id === song.id) ?? song;
      const position =
        state.current?.id === song.id
          ? '即將播放'
          : `第 ${state.items.length} 順位`;
      // 大螢幕飄一則點歌通知
      await publishDanmaku(pub, `🎵 ${requestedBy} 點了 ${songLabel(stored)}`);
      return `已點歌 🎵 ${songLabel(stored)}（編號 ${stored.songNumber}，${position}）`;
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

    case 'list': {
      const state = await store.getState();
      return formatQueueList(state);
    }

    case 'move_front': {
      const before = await store.getState();
      const target = before.items.find(
        (s) => s.songNumber === intent.songNumber
      );
      if (!target) {
        return `找不到編號 ${intent.songNumber} 的待播歌曲 🤔`;
      }
      const state = await store.moveToFront(intent.songNumber);
      await publishEvent(pub, {
        type: KtvEventType.QueueMoveToFront,
        payload: { songNumber: intent.songNumber },
      });
      await publishEvent(pub, {
        type: KtvEventType.QueueUpdated,
        payload: state,
      });
      // 大螢幕飄一則插歌通知
      await publishDanmaku(
        pub,
        `⏫ ${requestedBy} 把 ${songLabel(target)} 插到最前面`
      );
      return `⏫ 已把 ${songLabel(target)}（編號 ${intent.songNumber}）插到最前面，即將播放`;
    }

    case 'danmaku': {
      // 組成「暱稱：訊息」並發布彈幕事件；api 訂閱後直接轉發廣播給大螢幕。
      // 不在 Discord 回覆（回 null），避免每則閒聊都洗頻。
      const text = `${requestedBy}：${intent.text}`;
      await publishEvent(pub, {
        type: KtvEventType.Danmaku,
        payload: { text },
      });
      return null;
    }

    case 'help':
      return formatHelp();

    case 'ignore':
    default:
      return null;
  }
}
