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
  /**
   * 4 位數字歌曲編號（1000~9999），由 Redis 全域計數器配發，供使用者以編號插歌。
   * 必填以避免舊資料無號碼；由 enqueue 時的計數器統一配發。
   */
  songNumber: number;
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
 * Discord bot 的執行期設定（可於網頁設定、持久化於 Redis、bot 熱重連套用）。
 *
 * 安全備註：token 為機密。此型別用於 Redis 內部儲存；對外（GET）的回傳一律遮罩，
 * 只透露 hasToken 與 channelId，不回傳明文 token。
 */
export interface DiscordConfig {
  /** Discord bot token；null 表示尚未設定（bot 進入待命） */
  token: string | null;
  /** 限定監聽的頻道 id（純數字字串）；null 表示不限制頻道 */
  channelId: string | null;
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
  /**
   * 把指定編號的歌插到待播清單最前面（成為下一首），payload 帶 songNumber。
   * 訂閱端（api）收到後套用 store.moveToFront 並廣播最新 QueueState。
   */
  QueueMoveToFront = 'queue_move_to_front',
  /**
   * 依傳入的完整 id 順序重排待播清單，payload 帶 orderedIds。
   * 訂閱端（api）收到後套用 store.reorder 並廣播最新 QueueState。
   */
  QueueReorder = 'queue_reorder',
  /**
   * Discord 設定已更新。
   * 安全設計：payload 不帶明文 token，訂閱端（bot）收到後自行從 Redis 重讀最新 config，
   * 避免機密流經 Pub/Sub 頻道。
   */
  ConfigUpdated = 'config_updated',
  /**
   * 彈幕訊息（Discord 非命令閒聊）。payload 帶已格式化好的「暱稱：訊息」字串。
   * 這是一次性通知（非狀態），訂閱端（api）收到後直接轉發廣播、不碰佇列 store，
   * 前端收到後以動畫飄過大螢幕上方。
   */
  Danmaku = 'danmaku',
}

/** 彈幕事件的資料負載：已格式化好的顯示文字（例如「暱稱：訊息」） */
export interface DanmakuPayload {
  /** 要顯示的文字，已包含發送者暱稱與截斷處理 */
  text: string;
}

/** 事件的資料負載對應表 */
export interface KtvEventPayloadMap {
  [KtvEventType.QueueUpdated]: QueueState;
  [KtvEventType.Skip]: { reason?: string };
  [KtvEventType.Pause]: Record<string, never>;
  [KtvEventType.Play]: Record<string, never>;
  [KtvEventType.QueueMoveToFront]: { songNumber: number };
  [KtvEventType.QueueReorder]: { orderedIds: string[] };
  [KtvEventType.ConfigUpdated]: Record<string, never>;
  [KtvEventType.Danmaku]: DanmakuPayload;
}

/** 一個帶型別的事件（發布/訂閱時流通的形狀） */
export type KtvEvent =
  | { type: KtvEventType.QueueUpdated; payload: QueueState }
  | { type: KtvEventType.Skip; payload: { reason?: string } }
  | { type: KtvEventType.Pause; payload: Record<string, never> }
  | { type: KtvEventType.Play; payload: Record<string, never> }
  | { type: KtvEventType.QueueMoveToFront; payload: { songNumber: number } }
  | { type: KtvEventType.QueueReorder; payload: { orderedIds: string[] } }
  | { type: KtvEventType.ConfigUpdated; payload: Record<string, never> }
  | { type: KtvEventType.Danmaku; payload: DanmakuPayload };

/** WebSocket server → client 推播的訊息（目前與 KtvEvent 同構，另留版本欄位供演進） */
export interface ServerMessage {
  type: KtvEventType;
  payload:
    | QueueState
    | { reason?: string }
    | { songNumber: number }
    | { orderedIds: string[] }
    | DanmakuPayload
    | Record<string, never>;
}

/**
 * 建立一首歌的 factory，統一補齊 id 與時間戳。
 *
 * `songNumber` 由 Redis 全域計數器配發，因此透過 overrides 傳入；
 * 若未提供則暫記為 0（尚未配號），由 enqueue 時的 store 統一補上真正的 4 位編號。
 * @param videoId YouTube video id
 * @param requestedBy 點歌者
 * @param overrides 可覆寫其他欄位（例如 title、id、songNumber）
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
    songNumber: overrides.songNumber ?? 0,
    ...(overrides.title !== undefined ? { title: overrides.title } : {}),
  };
}

/** 空佇列狀態，供初始化使用 */
export function emptyQueueState(): QueueState {
  return { items: [], current: null, isPaused: false };
}

/** 空的 Discord 設定（尚未設定 token 與頻道），供初始化與壞資料 fallback 使用 */
export function emptyDiscordConfig(): DiscordConfig {
  return { token: null, channelId: null };
}
