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
  | { kind: 'help' }
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
export const SKIP_WORDS = ['跳過', '下一首', 'skip', 'next'];
export const PAUSE_WORDS = ['暫停', 'pause'];
export const PLAY_WORDS = ['繼續', '播放', 'play', 'resume'];
export const LIST_WORDS = ['清單', '列表', 'list', 'queue'];
/** 插歌指令關鍵字（後面接 4 位數字編號） */
export const MOVE_FRONT_WORDS = ['插歌', '插播', 'front', 'top'];
/** 說明指令關鍵字 */
export const HELP_WORDS = ['說明', '幫助', 'help'];

/** 控制指令必須帶的前綴（點歌除外）。 */
export const COMMAND_PREFIXES = ['!', '/'] as const;

/**
 * 拆解訊息前綴。回傳是否帶前綴，以及去前綴後 trim + 小寫的本體。
 * 未帶前綴時 body 仍為 trim + 小寫後的原文（供 danmaku fallback 判斷用）。
 */
function stripPrefix(content: string): { hasPrefix: boolean; body: string } {
  const trimmed = content.trim();
  const hasPrefix = COMMAND_PREFIXES.some((p) => trimmed.startsWith(p));
  const body = (hasPrefix ? trimmed.slice(1) : trimmed).trim().toLowerCase();
  return { hasPrefix, body };
}

/**
 * 判斷是否命中某控制指令。
 * 依新規則：控制指令一律需帶 `!` 或 `/` 前綴才生效；未帶前綴一律回 false（→ danmaku）。
 */
function matchesCommand(content: string, words: string[]): boolean {
  const { hasPrefix, body } = stripPrefix(content);
  if (!hasPrefix) return false;
  return words.some((w) => body === w.toLowerCase());
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
  if (matchesCommand(content, HELP_WORDS)) return { kind: 'help' };

  const moveFront = parseMoveFront(content);
  if (moveFront) return moveFront;

  // 有內容但非任何命令 → 當作彈幕（截斷至上限長度）
  return { kind: 'danmaku', text: truncateDanmaku(content.trim()) };
}

/**
 * 解析「插歌 <4 位編號>」意圖。
 * 依新規則：必須帶 `!` 或 `/` 前綴才生效，格式為「前綴+關鍵字 + 空白 + 4 位數字」，
 * 例如：「!插歌 1234」「!插播 1234」「!front 1234」「/top 1234」。
 * 未帶前綴、編號非恰 4 位數字、或參數數量不對，皆回傳 null（→ danmaku）。
 */
function parseMoveFront(content: string): MessageIntent | null {
  const { hasPrefix, body } = stripPrefix(content);
  if (!hasPrefix) return null;
  const parts = body.split(/\s+/);
  if (parts.length !== 2) return null;
  const [word, arg] = parts;
  const isMoveWord = MOVE_FRONT_WORDS.some((w) => word === w.toLowerCase());
  if (!isMoveWord) return null;
  if (!/^\d{4}$/.test(arg)) return null;
  return { kind: 'move_front', songNumber: Number(arg) };
}
