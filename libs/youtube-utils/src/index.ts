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

/** fetchVideoTitle 的可注入依賴，方便測試時替換掉真正的網路請求 */
export interface FetchVideoTitleDeps {
  /** 對應 global fetch，測試可注入 mock */
  fetch?: typeof fetch;
  /** 逾時毫秒數，預設 5000ms */
  timeoutMs?: number;
}

/** YouTube oEmbed 端點；免 API key，回傳的 JSON 內含影片標題 */
const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';

/**
 * 透過 YouTube oEmbed 取得影片標題。
 *
 * 設計為「盡力而為」：任何失敗（網路錯誤、逾時、影片不存在或私人、
 * 回應非預期格式）都回傳 null，讓呼叫端 fallback 到 videoId，
 * 點歌流程不因抓標題失敗而中斷。
 *
 * @param videoId 11 碼 YouTube video id
 * @param deps 可注入的 fetch 與逾時設定（測試用）
 * @returns 成功時回傳非空標題字串，否則回傳 null
 */
export async function fetchVideoTitle(
  videoId: string,
  deps: FetchVideoTitleDeps = {}
): Promise<string | null> {
  if (!isValidVideoId(videoId)) {
    return null;
  }

  const fetchFn = deps.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    return null;
  }

  const timeoutMs = deps.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const target = new URL(OEMBED_ENDPOINT);
    target.searchParams.set(
      'url',
      `https://www.youtube.com/watch?v=${videoId}`
    );
    target.searchParams.set('format', 'json');

    const res = await fetchFn(target.toString(), {
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }

    const data: unknown = await res.json();
    const title =
      typeof data === 'object' && data !== null
        ? (data as { title?: unknown }).title
        : undefined;

    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim();
    }
    return null;
  } catch {
    // 網路錯誤 / abort / JSON 解析失敗都視為抓不到標題
    return null;
  } finally {
    clearTimeout(timer);
  }
}
