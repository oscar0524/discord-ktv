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

  it('一般聊天訊息回傳 ignore', () => {
    expect(parseMessage('今天天氣真好').kind).toBe('ignore');
    expect(parseMessage('').kind).toBe('ignore');
  });

  it('連結優先於指令關鍵字', () => {
    const intent = parseMessage('skip https://youtu.be/dQw4w9WgXcQ');
    expect(intent).toEqual({ kind: 'enqueue', videoId: 'dQw4w9WgXcQ' });
  });
});
