/**
 * @discord-ktv/shared-types
 *
 * 系統共用的核心型別與事件協定。
 * 三個 app（discord-bot、api、web）與其他 lib 皆依賴此處定義，
 * 作為 Redis 資料結構、Pub/Sub 事件、WebSocket 訊息的單一事實來源。
 */

/** 一首待播/播放中的歌曲 */
export interface Song {
  /** 佇列項目唯一 id（例如 crypto.randomUUID()） */
  id: string;
  /** YouTube video id（11 碼），前端 iframe 直接用此播放 */
  videoId: string;
  /** 歌名（可選，本階段貼連結不解析標題，保留欄位供未來擴充） */
  title?: string;
  /** 點歌者的 Discord 顯示名稱或 user id */
  requestedBy: string;
  /** 點歌時間（epoch millis） */
  requestedAt: number;
}

/** 播放器 / 佇列的整體狀態，API 會把此結構推播給前端 */
export interface QueueState {
  /** 待播清單（不含目前播放中的歌曲） */
  items: Song[];
  /** 目前播放中的歌曲，無則為 null */
  current: Song | null;
  /** 是否暫停 */
  isPaused: boolean;
}

/**
 * Redis Pub/Sub 事件類型。
 * discord-bot 與 api 的控制端點會 publish 這些事件，api 訂閱後轉成 WebSocket 訊息推給前端。
 */
export enum KtvEventType {
  /** 佇列內容有變動（新增、移除、推進），payload 帶最新 QueueState */
  QueueUpdated = 'queue_updated',
  /** 跳過目前歌曲 */
  Skip = 'skip',
  /** 暫停播放 */
  Pause = 'pause',
  /** 繼續播放 */
  Play = 'play',
}

/** 事件的資料負載對應表 */
export interface KtvEventPayloadMap {
  [KtvEventType.QueueUpdated]: QueueState;
  [KtvEventType.Skip]: { reason?: string };
  [KtvEventType.Pause]: Record<string, never>;
  [KtvEventType.Play]: Record<string, never>;
}

/** 一個帶型別的事件（發布/訂閱時流通的形狀） */
export type KtvEvent =
  | { type: KtvEventType.QueueUpdated; payload: QueueState }
  | { type: KtvEventType.Skip; payload: { reason?: string } }
  | { type: KtvEventType.Pause; payload: Record<string, never> }
  | { type: KtvEventType.Play; payload: Record<string, never> };

/** WebSocket server → client 推播的訊息（目前與 KtvEvent 同構，另留版本欄位供演進） */
export interface ServerMessage {
  type: KtvEventType;
  payload: QueueState | { reason?: string } | Record<string, never>;
}

/**
 * 建立一首歌的 factory，統一補齊 id 與時間戳。
 * @param videoId YouTube video id
 * @param requestedBy 點歌者
 * @param overrides 可覆寫其他欄位（例如 title、id）
 */
export function createSong(
  videoId: string,
  requestedBy: string,
  overrides: Partial<Song> = {}
): Song {
  return {
    id:
      overrides.id ??
      (typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `song_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
    videoId,
    requestedBy,
    requestedAt: overrides.requestedAt ?? Date.now(),
    ...(overrides.title !== undefined ? { title: overrides.title } : {}),
  };
}

/** 空佇列狀態，供初始化使用 */
export function emptyQueueState(): QueueState {
  return { items: [], current: null, isPaused: false };
}
