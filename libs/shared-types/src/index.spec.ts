import {
  createSong,
  emptyQueueState,
  KtvEventType,
  type Song,
} from './index';

describe('shared-types', () => {
  describe('createSong', () => {
    it('補齊 id / requestedAt 並保留傳入欄位', () => {
      const song = createSong('dQw4w9WgXcQ', 'oscar');
      expect(song.videoId).toBe('dQw4w9WgXcQ');
      expect(song.requestedBy).toBe('oscar');
      expect(typeof song.id).toBe('string');
      expect(song.id.length).toBeGreaterThan(0);
      expect(typeof song.requestedAt).toBe('number');
      // 未提供 title 時不應出現該欄位
      expect('title' in song).toBe(false);
    });

    it('可透過 overrides 覆寫 title / id', () => {
      const song = createSong('abc12345678', 'user', {
        title: '稻香',
        id: 'fixed-id',
      });
      expect(song.title).toBe('稻香');
      expect(song.id).toBe('fixed-id');
    });

    it('產生的 id 應唯一', () => {
      const a = createSong('v1', 'u');
      const b = createSong('v2', 'u');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('emptyQueueState', () => {
    it('回傳空佇列、無播放中、未暫停', () => {
      const state = emptyQueueState();
      expect(state.items).toEqual([]);
      expect(state.current).toBeNull();
      expect(state.isPaused).toBe(false);
    });
  });

  describe('KtvEventType', () => {
    it('定義四種事件', () => {
      expect(KtvEventType.QueueUpdated).toBe('queue_updated');
      expect(KtvEventType.Skip).toBe('skip');
      expect(KtvEventType.Pause).toBe('pause');
      expect(KtvEventType.Play).toBe('play');
    });
  });

  it('Song 型別可被組成 QueueState', () => {
    const items: Song[] = [createSong('v', 'u')];
    const state = { ...emptyQueueState(), items };
    expect(state.items).toHaveLength(1);
  });
});
