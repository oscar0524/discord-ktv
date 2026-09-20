import type { Redis } from 'ioredis';
import {
  emptyQueueState,
  type QueueState,
  type Song,
} from '@discord-ktv/shared-types';
import { KEY_QUEUE_STATE } from './keys';

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
   * 將歌曲加入佇列。
   * 若目前沒有播放中的歌曲，直接成為 current；否則排入 items 尾端。
   * @returns 更新後的狀態
   */
  async enqueue(song: Song): Promise<QueueState> {
    const state = await this.getState();
    if (state.current === null) {
      state.current = song;
    } else {
      state.items.push(song);
    }
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

  /** 清空整個佇列 */
  async clear(): Promise<QueueState> {
    const state = emptyQueueState();
    await this.setState(state);
    return state;
  }
}
