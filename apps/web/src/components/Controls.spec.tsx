import { render, screen, fireEvent } from '@testing-library/react';
import { Controls } from './Controls';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    skip: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    playbackEnded: jest.fn(),
  },
}));

describe('Controls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('未暫停時顯示暫停鈕，點擊呼叫 api.pause', () => {
    render(<Controls isPaused={false} />);
    fireEvent.click(screen.getByTestId('btn-pause'));
    expect(api.pause).toHaveBeenCalledTimes(1);
  });

  it('暫停時顯示繼續鈕，點擊呼叫 api.play', () => {
    render(<Controls isPaused={true} />);
    fireEvent.click(screen.getByTestId('btn-play'));
    expect(api.play).toHaveBeenCalledTimes(1);
  });

  it('跳過鈕呼叫 api.skip', () => {
    render(<Controls isPaused={false} />);
    fireEvent.click(screen.getByTestId('btn-skip'));
    expect(api.skip).toHaveBeenCalledTimes(1);
  });
});
