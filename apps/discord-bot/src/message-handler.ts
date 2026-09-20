import { parseVideoId } from '@discord-ktv/youtube-utils';

/**
 * 訊息解析結果（意圖）。把「解析」與「副作用」分離，方便測試。
 */
export type MessageIntent =
  | { kind: 'enqueue'; videoId: string }
  | { kind: 'skip' }
  | { kind: 'pause' }
  | { kind: 'play' }
  | { kind: 'ignore' };

/** 指令關鍵字（中英皆可） */
const SKIP_WORDS = ['跳過', '下一首', 'skip', 'next'];
const PAUSE_WORDS = ['暫停', 'pause'];
const PLAY_WORDS = ['繼續', '播放', 'play', 'resume'];

function matchesCommand(content: string, words: string[]): boolean {
  const normalized = content.trim().toLowerCase();
  // 支援 "!skip" 或 "跳過" 這類，去掉開頭的 ! / /
  const stripped = normalized.replace(/^[!/]/, '');
  return words.some((w) => stripped === w.toLowerCase());
}

/**
 * 純函式：從訊息內容判斷意圖。
 * - 內含可解析的 YouTube 連結 → enqueue
 * - 命中控制指令 → skip / pause / play
 * - 其他 → ignore
 *
 * 注意：呼叫端應先過濾掉 bot 自己與其他 bot 的訊息。
 */
export function parseMessage(content: string): MessageIntent {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { kind: 'ignore' };
  }

  // 優先嘗試從訊息中的任一 token 解析 YouTube 連結
  for (const token of content.split(/\s+/)) {
    const videoId = parseVideoId(token);
    if (videoId) {
      return { kind: 'enqueue', videoId };
    }
  }

  if (matchesCommand(content, SKIP_WORDS)) return { kind: 'skip' };
  if (matchesCommand(content, PAUSE_WORDS)) return { kind: 'pause' };
  if (matchesCommand(content, PLAY_WORDS)) return { kind: 'play' };

  return { kind: 'ignore' };
}
