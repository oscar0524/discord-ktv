import { parseVideoId, isYouTubeUrl } from './index';

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
