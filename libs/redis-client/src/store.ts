import type { Redis } from 'ioredis';
import {
  emptyQueueState,
  type QueueState,
  type Song,
} from '@discord-ktv/shared-types';
import { KEY_QUEUE_STATE, KEY_QUEUE_COUNTER } from './keys';

/** 歌曲編號區間（含頭尾）：1000~9999，共 9000 個號碼循環使用 */
const SONG_NUMBER_MIN = 1000;
const SONG_NUMBER_MAX = 9999;
const SONG_NUMBER_RANGE = SONG_NUMBER_MAX - SONG_NUMBER_MIN + 1;

/**
 * KtvStore 封裝佇列狀態的讀寫。
 *
 * 設計選擇：整個佇列狀態（items / current / isPaused）以單一 JSON string 存於
 * KEY_QUEUE_STATE。單一全域佇列、資料量小，用一顆 key 讀寫最單純，也讓「推播完整
 * QueueState」很自然。若未來要多包廂再改為 per-room key。
 */
export class KtvStore {
  constructor(private readonly redis: Redis) {}

  /** 讀取目前佇列狀態；尚未初始化時回傳空狀態 */
  async getState(): Promise<QueueState> {
    const raw = await this.redis.get(KEY_QUEUE_STATE);
    if (!raw) {
      return emptyQueueState();
    }
    try {
      return JSON.parse(raw) as QueueState;
    } catch {
      return emptyQueueState();
    }
  }

  /** 覆寫整個佇列狀態 */
  async setState(state: QueueState): Promise<void> {
    await this.redis.set(KEY_QUEUE_STATE, JSON.stringify(state));
  }

  /**
   * 以 Redis INCR 原子取得下一個歌曲編號，映射到 1000~9999 循環。
   * 單一原子操作避免競態；超過 9999 後繞回 1000。
   * @returns 4 位數字編號（1000~9999）
   */
  async nextSongNumber(): Promise<number> {
    const counter = await this.redis.incr(KEY_QUEUE_COUNTER);
    // counter 從 1 起算；(counter - 1) % RANGE 得 0..8999，再加 MIN
    return SONG_NUMBER_MIN + ((counter - 1) % SONG_NUMBER_RANGE);
  }

  /**
   * 將歌曲加入佇列，並在 store 內以計數器統一配發 songNumber（集中配號邏輯）。
   * 若目前沒有播放中的歌曲，直接成為 current；否則排入 items 尾端。
   * @returns 更新後的狀態
   */
  async enqueue(song: Song): Promise<QueueState> {
    const songNumber = await this.nextSongNumber();
    const numbered: Song = { ...song, songNumber };
    const state = await this.getState();
    if (state.current === null) {
      state.current = numbered;
    } else {
      state.items.push(numbered);
    }
    await this.setState(state);
    return state;
  }

  /**
   * 把指定編號的歌插到待播清單最前面（成為下一首），不改動 current。
   * 在 items 中找到該 songNumber 的歌，移到 items[0]；找不到則狀態不變。
   * @returns 更新後的狀態
   */
  async moveToFront(songNumber: number): Promise<QueueState> {
    const state = await this.getState();
    const idx = state.items.findIndex((s) => s.songNumber === songNumber);
    if (idx <= 0) {
      // idx === -1（找不到）或 idx === 0（已在最前）皆不需變動
      return state;
    }
    const [song] = state.items.splice(idx, 1);
    state.items.unshift(song);
    await this.setState(state);
    return state;
  }

  /**
   * 依傳入的 id 順序重排待播清單 items。
   * 容錯：忽略不存在的 id；未列出的既有項目保留於尾端以防漏項。
   * @param orderedIds 期望的 items id 順序
   * @returns 更新後的狀態
   */
  async reorder(orderedIds: string[]): Promise<QueueState> {
    const state = await this.getState();
    const byId = new Map(state.items.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const reordered: Song[] = [];
    for (const id of orderedIds) {
      const song = byId.get(id);
      if (song && !seen.has(id)) {
        reordered.push(song);
        seen.add(id);
      }
    }
    // 保留未在 orderedIds 中列出的既有項目（維持原相對順序）於尾端
    for (const song of state.items) {
      if (!seen.has(song.id)) {
        reordered.push(song);
      }
    }
    state.items = reordered;
    await this.setState(state);
    return state;
  }

  /** 查看目前播放中的歌曲（不改變狀態） */
  async peek(): Promise<Song | null> {
    const state = await this.getState();
    return state.current;
  }

  /**
   * 推進到下一首：丟棄 current，把 items 第一首設為 current。
   * 用於「播完自動下一首」與「跳過」。
   * @returns 更新後的狀態
   */
  async advance(): Promise<QueueState> {
    const state = await this.getState();
    state.current = state.items.shift() ?? null;
    await this.setState(state);
    return state;
  }

  /** 設定暫停旗標 */
  async setPaused(isPaused: boolean): Promise<QueueState> {
    const state = await this.getState();
    state.isPaused = isPaused;
    await this.setState(state);
    return state;
  }

  /**
   * 清空整個佇列。
   * 刻意不重置 KEY_QUEUE_COUNTER，維持 session 內編號持續遞增以降低短期重號機率。
   */
  async clear(): Promise<QueueState> {
    const state = emptyQueueState();
    await this.setState(state);
    return state;
  }
}
