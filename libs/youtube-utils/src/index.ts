/**
 * @discord-ktv/youtube-utils
 *
 * 從使用者貼上的 YouTube 連結解析出 11 碼 video id。
 * 本階段點歌只吃連結（不呼叫 YouTube Data API），因此這是 Discord bot 的核心解析點。
 */

/** YouTube video id 為 11 碼，字元集為 [A-Za-z0-9_-] */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** 驗證候選字串是否為合法的 11 碼 video id */
function isValidVideoId(candidate: string | undefined | null): candidate is string {
  return typeof candidate === 'string' && VIDEO_ID_RE.test(candidate);
}

/**
 * 從 YouTube 連結解析 video id。支援：
 * - youtube.com/watch?v=VIDEO_ID（含額外 query 參數、任意子網域）
 * - youtu.be/VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 *
 * @param input 使用者貼上的字串
 * @returns 合法時回傳 11 碼 video id，否則回傳 null
 */
export function parseVideoId(input: string): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const raw = input.trim();
  if (raw.length === 0) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // 短網址 youtu.be/VIDEO_ID
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return isValidVideoId(id) ? id : null;
  }

  // 僅接受 youtube 系列網域
  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host.endsWith('.youtube.com');
  if (!isYouTubeHost) {
    return null;
  }

  // watch?v=VIDEO_ID
  const vParam = url.searchParams.get('v');
  if (isValidVideoId(vParam)) {
    return vParam;
  }

  // /shorts/VIDEO_ID 或 /embed/VIDEO_ID
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && (segments[0] === 'shorts' || segments[0] === 'embed')) {
    const id = segments[1];
    return isValidVideoId(id) ? id : null;
  }

  return null;
}

/** 判斷字串是否為可解析出 video id 的 YouTube 連結 */
export function isYouTubeUrl(input: string): boolean {
  return parseVideoId(input) !== null;
}
