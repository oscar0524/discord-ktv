import { parseVideoId } from '@discord-ktv/youtube-utils';

/**
 * 訊息解析結果（意圖）。把「解析」與「副作用」分離，方便測試。
 */
export type MessageIntent =
  | { kind: 'enqueue'; videoId: string }
  | { kind: 'skip' }
  | { kind: 'pause' }
  | { kind: 'play' }
  | { kind: 'list' }
  | { kind: 'move_front'; songNumber: number }
  | { kind: 'danmaku'; text: string }
  | { kind: 'ignore' };

/** 彈幕文字上限（超過截斷），避免過長訊息佔滿螢幕 */
export const DANMAKU_MAX_LENGTH = 80;

/** 把文字截斷至上限長度（超過時以 … 結尾） */
function truncateDanmaku(text: string): string {
  if (text.length <= DANMAKU_MAX_LENGTH) return text;
  return `${text.slice(0, DANMAKU_MAX_LENGTH - 1)}…`;
}

/** 指令關鍵字（中英皆可） */
const SKIP_WORDS = ['跳過', '下一首', 'skip', 'next'];
const PAUSE_WORDS = ['暫停', 'pause'];
const PLAY_WORDS = ['繼續', '播放', 'play', 'resume'];
const LIST_WORDS = ['清單', '列表', 'list', 'queue'];
/** 插歌指令關鍵字（後面接 4 位數字編號） */
const MOVE_FRONT_WORDS = ['插歌', '插播', 'front', 'top'];

function matchesCommand(content: string, words: string[]): boolean {
  const normalized = content.trim().toLowerCase();
  // 支援 "!skip" 或 "跳過" 這類，去掉開頭的 ! / /
  const stripped = normalized.replace(/^[!/]/, '');
  return words.some((w) => stripped === w.toLowerCase());
}

/**
 * 純函式：從訊息內容判斷意圖。
 * - 空白訊息 → ignore
 * - 內含可解析的 YouTube 連結 → enqueue
 * - 命中控制指令 → skip / pause / play / list / move_front
 * - 其他「有內容但非任何命令」→ danmaku（飄過大螢幕的彈幕，含 80 字截斷）
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
  if (matchesCommand(content, LIST_WORDS)) return { kind: 'list' };

  const moveFront = parseMoveFront(content);
  if (moveFront) return moveFront;

  // 有內容但非任何命令 → 當作彈幕（截斷至上限長度）
  return { kind: 'danmaku', text: truncateDanmaku(content.trim()) };
}

/**
 * 解析「插歌 <4 位編號>」意圖。
 * 支援中英關鍵字與 `!`/`/` 前綴，格式為「關鍵字 + 空白 + 4 位數字」，
 * 例如：「插歌 1234」「插播 1234」「!front 1234」「/top 1234」。
 * 編號必須恰為 4 位數字（1000~9999 區間內的字面 4 碼）；不合法則回傳 null（→ ignore）。
 */
function parseMoveFront(content: string): MessageIntent | null {
  const normalized = content.trim().toLowerCase();
  const stripped = normalized.replace(/^[!/]/, '');
  const parts = stripped.split(/\s+/);
  if (parts.length !== 2) return null;
  const [word, arg] = parts;
  const isMoveWord = MOVE_FRONT_WORDS.some((w) => word === w.toLowerCase());
  if (!isMoveWord) return null;
  if (!/^\d{4}$/.test(arg)) return null;
  return { kind: 'move_front', songNumber: Number(arg) };
}
