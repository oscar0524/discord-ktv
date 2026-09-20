import { render, screen } from '@testing-library/react';
import type { Song } from '@discord-ktv/shared-types';
import { Player } from './Player';
import { api } from '../api/client';
import YouTubePlayer from 'youtube-player';

jest.mock('../api/client', () => ({
  api: {
    skip: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    playbackEnded: jest.fn(),
  },
}));

// 攔截 youtube-player factory：回傳一個假的 player，並保存 stateChange listener。
type StateChangeListener = (event: { data: number }) => void;

let stateChangeListener: StateChangeListener | undefined;
const mockPlayer = {
  loadVideoById: jest.fn(() => Promise.resolve()),
  playVideo: jest.fn(() => Promise.resolve()),
  pauseVideo: jest.fn(() => Promise.resolve()),
  destroy: jest.fn(() => Promise.resolve()),
  on: jest.fn((eventType: string, listener: StateChangeListener) => {
    if (eventType === 'stateChange') stateChangeListener = listener;
  }),
};

jest.mock('youtube-player', () => ({
  __esModule: true,
  default: jest.fn(() => mockPlayer),
}));

const factory = YouTubePlayer as unknown as jest.Mock;

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'q1',
    videoId: 'abc12345678',
    requestedBy: 'oscar',
    requestedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('Player', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stateChangeListener = undefined;
  });

  it('current 為 null 時顯示等待點歌中的空狀態', () => {
    render(<Player current={null} />);
    const empty = screen.getByTestId('player-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent('等待點歌中');
    expect(factory).not.toHaveBeenCalled();
  });

  it('有 current 時建立一次 player，帶正確 videoId 與 autoplay', () => {
    const song = makeSong({ videoId: 'vid00000001' });
    render(<Player current={song} />);

    expect(factory).toHaveBeenCalledTimes(1);
    const [, options] = factory.mock.calls[0];
    expect(options.videoId).toBe('vid00000001');
    expect(options.playerVars.autoplay).toBe(1);
  });

  it('stateChange 為 ENDED(0) 時呼叫 api.playbackEnded', () => {
    render(<Player current={makeSong()} />);
    expect(stateChangeListener).toBeDefined();

    stateChangeListener?.({ data: 0 });
    expect(api.playbackEnded).toHaveBeenCalledTimes(1);

    // 非 ENDED 狀態不應觸發
    stateChangeListener?.({ data: 1 });
    expect(api.playbackEnded).toHaveBeenCalledTimes(1);
  });

  it('初始為暫停時，建立 player 後套用 pauseVideo', () => {
    render(<Player current={makeSong()} isPaused={true} />);
    expect(mockPlayer.pauseVideo).toHaveBeenCalled();
  });
});
