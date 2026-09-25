import { parseMessage } from './message-handler';

describe('parseMessage', () => {
  it('從純連結解析為 enqueue', () => {
    expect(parseMessage('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'enqueue',
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it('從夾帶文字的訊息中找出連結', () => {
    const intent = parseMessage(
      '幫我點這首 https://www.youtube.com/watch?v=dQw4w9WgXcQ 謝謝'
    );
    expect(intent).toEqual({ kind: 'enqueue', videoId: 'dQw4w9WgXcQ' });
  });

  it.each([
    ['跳過', 'skip'],
    ['skip', 'skip'],
    ['!skip', 'skip'],
    ['下一首', 'skip'],
    ['暫停', 'pause'],
    ['!pause', 'pause'],
    ['繼續', 'play'],
    ['play', 'play'],
  ])('指令 %s → %s', (content, kind) => {
    expect(parseMessage(content).kind).toBe(kind);
  });

  it.each([
    ['清單', 'list'],
    ['列表', 'list'],
    ['list', 'list'],
    ['!list', 'list'],
    ['/queue', 'list'],
  ])('指令 %s → %s', (content, kind) => {
    expect(parseMessage(content).kind).toBe(kind);
  });

  it.each([
    ['插歌 1234', 1234],
    ['插播 5678', 5678],
    ['!front 1000', 1000],
    ['/top 9999', 9999],
    ['FRONT 4321', 4321],
  ])('插歌指令 %s → move_front', (content, songNumber) => {
    expect(parseMessage(content)).toEqual({ kind: 'move_front', songNumber });
  });

  it.each([
    ['插歌 123'], // 非 4 位
    ['插歌 12345'], // 5 位
    ['插歌 abcd'], // 非數字
    ['插歌'], // 缺參數
    ['插歌 1234 5678'], // 多餘參數
  ])('非法插歌指令 %s → danmaku（非任何命令即彈幕）', (content) => {
    const intent = parseMessage(content);
    expect(intent).toEqual({ kind: 'danmaku', text: content });
  });

  it('一般聊天訊息回傳 danmaku（含 trim 後文字）', () => {
    expect(parseMessage('今天天氣真好')).toEqual({
      kind: 'danmaku',
      text: '今天天氣真好',
    });
    expect(parseMessage('  嗨大家好  ')).toEqual({
      kind: 'danmaku',
      text: '嗨大家好',
    });
  });

  it('空白訊息仍回傳 ignore', () => {
    expect(parseMessage('').kind).toBe('ignore');
    expect(parseMessage('   ').kind).toBe('ignore');
  });

  it('超過 80 字的彈幕會被截斷至 80 字（以 … 結尾）', () => {
    const long = 'a'.repeat(200);
    const intent = parseMessage(long);
    expect(intent.kind).toBe('danmaku');
    if (intent.kind === 'danmaku') {
      expect(intent.text).toHaveLength(80);
      expect(intent.text.endsWith('…')).toBe(true);
    }
  });

  it('連結優先於指令關鍵字', () => {
    const intent = parseMessage('skip https://youtu.be/dQw4w9WgXcQ');
    expect(intent).toEqual({ kind: 'enqueue', videoId: 'dQw4w9WgXcQ' });
  });
});
