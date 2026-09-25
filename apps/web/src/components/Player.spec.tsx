import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Song } from '@discord-ktv/shared-types';
import { Player } from './Player';
import { api } from '../api/client';
import { YouTubeApiProvider } from '../youtube/YouTubeApiContext';

jest.mock('../api/client', () => ({
  api: {
    skip: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    playbackEnded: jest.fn(),
  },
}));

// 假的 YT.Player：保存最後一次 onStateChange listener 與建構參數，
// 並提供可被斷言的方法。建構子與方法皆為 jest.fn 以便驗證呼叫。
type StateChangeListener = (event: { data: number }) => void;

let stateChangeListener: StateChangeListener | undefined;
// 保存 onReady：真實 API 的控制方法（pauseVideo…）需在 onReady 後才可用，
// 測試須手動觸發此回呼以模擬 iframe 就緒。
let readyListener: (() => void) | undefined;
const playerMethods = {
  loadVideoById: jest.fn(),
  playVideo: jest.fn(),
  pauseVideo: jest.fn(),
  destroy: jest.fn(),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PlayerCtor = jest.fn(function (this: any, _el: unknown, options: any) {
  stateChangeListener = options?.events?.onStateChange;
  readyListener = options?.events?.onReady;
  return Object.assign(this, playerMethods);
});

const fakeYT = {
  Player: PlayerCtor,
  PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
};

/** 以就緒的 window.YT 包住 Player，讓 provider 一掛載即為就緒狀態。 */
function renderReady(ui: ReactNode) {
  (window as unknown as { YT: unknown }).YT = fakeYT;
  return render(<YouTubeApiProvider>{ui}</YouTubeApiProvider>);
}

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
    readyListener = undefined;
  });

  afterEach(() => {
    delete (window as { YT?: unknown }).YT;
    delete (window as { onYouTubeIframeAPIReady?: unknown })
      .onYouTubeIframeAPIReady;
  });

  it('current 為 null 時顯示等待點歌中的空狀態', () => {
    renderReady(<Player current={null} />);
    const empty = screen.getByTestId('player-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent('等待點歌中');
    expect(PlayerCtor).not.toHaveBeenCalled();
  });

  it('YT 尚未就緒時不建立 player，顯示載入中畫面', () => {
    // 不設定 window.YT，provider 維持 null。
    render(
      <YouTubeApiProvider>
        <Player current={makeSong()} />
      </YouTubeApiProvider>
    );
    expect(screen.getByTestId('player-empty')).toHaveTextContent(
      '播放器載入中'
    );
    expect(PlayerCtor).not.toHaveBeenCalled();
  });

  it('有 current 時建立一次 player，帶正確 videoId 與 autoplay', () => {
    const song = makeSong({ videoId: 'vid00000001' });
    renderReady(<Player current={song} />);

    expect(PlayerCtor).toHaveBeenCalledTimes(1);
    const [, options] = PlayerCtor.mock.calls[0];
    expect(options.videoId).toBe('vid00000001');
    expect(options.playerVars.autoplay).toBe(1);
  });

  it('onStateChange 為 ENDED(0) 時呼叫 api.playbackEnded，非 ENDED 不呼叫', () => {
    renderReady(<Player current={makeSong()} />);
    expect(stateChangeListener).toBeDefined();

    stateChangeListener?.({ data: 0 });
    expect(api.playbackEnded).toHaveBeenCalledTimes(1);

    // 非 ENDED 狀態不應觸發
    stateChangeListener?.({ data: 1 });
    expect(api.playbackEnded).toHaveBeenCalledTimes(1);
  });

  it('初始為暫停時，player 就緒(onReady)後才套用 pauseVideo', () => {
    renderReady(<Player current={makeSong()} isPaused={true} />);
    // onReady 尚未觸發前不應呼叫控制方法（避免 not a function）。
    expect(playerMethods.pauseVideo).not.toHaveBeenCalled();

    // 模擬 iframe 就緒。
    act(() => readyListener?.());
    expect(playerMethods.pauseVideo).toHaveBeenCalled();
  });
});
