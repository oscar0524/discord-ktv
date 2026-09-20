import { parseVideoId, isYouTubeUrl, fetchVideoTitle } from './index';

const VALID_ID = 'dQw4w9WgXcQ';

describe('parseVideoId', () => {
  describe('標準 watch?v= 格式', () => {
    it.each([
      `https://www.youtube.com/watch?v=${VALID_ID}`,
      `http://youtube.com/watch?v=${VALID_ID}`,
      `https://m.youtube.com/watch?v=${VALID_ID}`,
      `https://www.youtube.com/watch?v=${VALID_ID}&t=30s`,
      `https://www.youtube.com/watch?list=abc&v=${VALID_ID}`,
    ])('解析 %s', (url) => {
      expect(parseVideoId(url)).toBe(VALID_ID);
    });
  });

  describe('短網址 youtu.be 格式', () => {
    it.each([
      `https://youtu.be/${VALID_ID}`,
      `http://youtu.be/${VALID_ID}`,
      `https://youtu.be/${VALID_ID}?t=42`,
    ])('解析 %s', (url) => {
      expect(parseVideoId(url)).toBe(VALID_ID);
    });
  });

  describe('shorts 格式', () => {
    it.each([
      `https://www.youtube.com/shorts/${VALID_ID}`,
      `https://youtube.com/shorts/${VALID_ID}?feature=share`,
    ])('解析 %s', (url) => {
      expect(parseVideoId(url)).toBe(VALID_ID);
    });
  });

  describe('embed 格式', () => {
    it('解析 embed URL', () => {
      expect(parseVideoId(`https://www.youtube.com/embed/${VALID_ID}`)).toBe(
        VALID_ID
      );
    });
  });

  describe('前後空白容錯', () => {
    it('去除首尾空白', () => {
      expect(parseVideoId(`  https://youtu.be/${VALID_ID}  `)).toBe(VALID_ID);
    });
  });

  describe('無效輸入回傳 null', () => {
    it.each([
      '',
      '   ',
      'not a url',
      'https://example.com/watch?v=abc',
      'https://www.youtube.com/watch?v=short',
      'https://vimeo.com/123456',
      'https://youtu.be/',
      'https://www.youtube.com/',
    ])('拒絕 %s', (url) => {
      expect(parseVideoId(url)).toBeNull();
    });

    it('非字串輸入回傳 null', () => {
      // @ts-expect-error 測試防禦性行為
      expect(parseVideoId(undefined)).toBeNull();
      // @ts-expect-error 測試防禦性行為
      expect(parseVideoId(null)).toBeNull();
    });
  });
});

describe('isYouTubeUrl', () => {
  it('對可解析出 videoId 的字串回傳 true', () => {
    expect(isYouTubeUrl(`https://youtu.be/${VALID_ID}`)).toBe(true);
  });
  it('對無法解析的字串回傳 false', () => {
    expect(isYouTubeUrl('https://example.com')).toBe(false);
  });
});

describe('fetchVideoTitle', () => {
  const VALID_ID = 'dQw4w9WgXcQ';

  function mockFetch(
    impl: (url: string, init?: RequestInit) => Promise<Partial<Response>>
  ): typeof fetch {
    return jest.fn(impl) as unknown as typeof fetch;
  }

  it('成功時回傳去除首尾空白的標題', async () => {
    const fetch = mockFetch(async () => ({
      ok: true,
      json: async () => ({ title: '  Never Gonna Give You Up  ' }),
    }));

    const title = await fetchVideoTitle(VALID_ID, { fetch });
    expect(title).toBe('Never Gonna Give You Up');
  });

  it('呼叫 oEmbed 端點並帶上正確的 url 與 format 參數', async () => {
    const fetch = mockFetch(async (url) => {
      expect(url).toContain('https://www.youtube.com/oembed');
      expect(url).toContain(
        encodeURIComponent(`https://www.youtube.com/watch?v=${VALID_ID}`)
      );
      expect(url).toContain('format=json');
      return { ok: true, json: async () => ({ title: 'ok' }) };
    });

    expect(await fetchVideoTitle(VALID_ID, { fetch })).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('無效 videoId 直接回 null 且不呼叫 fetch', async () => {
    const fetch = mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(await fetchVideoTitle('short', { fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('HTTP 非 2xx（例如影片不存在）回傳 null', async () => {
    const fetch = mockFetch(async () => ({ ok: false, status: 404 }));
    expect(await fetchVideoTitle(VALID_ID, { fetch })).toBeNull();
  });

  it('fetch 拋錯（網路錯誤 / abort）回傳 null', async () => {
    const fetch = mockFetch(async () => {
      throw new Error('network down');
    });
    expect(await fetchVideoTitle(VALID_ID, { fetch })).toBeNull();
  });

  it('回應缺少 title 欄位或為空字串時回傳 null', async () => {
    const missing = mockFetch(async () => ({
      ok: true,
      json: async () => ({}),
    }));
    expect(await fetchVideoTitle(VALID_ID, { fetch: missing })).toBeNull();

    const blank = mockFetch(async () => ({
      ok: true,
      json: async () => ({ title: '   ' }),
    }));
    expect(await fetchVideoTitle(VALID_ID, { fetch: blank })).toBeNull();
  });
});
