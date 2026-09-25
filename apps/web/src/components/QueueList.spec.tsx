import { render, screen, fireEvent } from '@testing-library/react';
import { createSong, emptyQueueState } from '@discord-ktv/shared-types';
import { QueueList } from './QueueList';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    moveToFront: jest.fn(),
    reorder: jest.fn(),
  },
}));

describe('QueueList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('空清單顯示提示文字', () => {
    render(<QueueList state={emptyQueueState()} />);
    expect(screen.getByText(/沒有待播歌曲/)).toBeInTheDocument();
  });

  it('渲染待播歌曲、編號與點歌者', () => {
    const state = {
      ...emptyQueueState(),
      items: [
        createSong('aaaaaaaaaaa', 'oscar', { title: '稻香', songNumber: 1000 }),
        createSong('bbbbbbbbbbb', 'amy', { songNumber: 1001 }),
      ],
    };
    render(<QueueList state={state} />);
    expect(screen.getByTestId('queue-list')).toBeInTheDocument();
    expect(screen.getByText(/稻香/)).toBeInTheDocument();
    expect(screen.getByText(/編號 1000/)).toBeInTheDocument();
    expect(screen.getByText(/編號 1001/)).toBeInTheDocument();
    expect(screen.getByText(/點歌者：oscar/)).toBeInTheDocument();
    expect(screen.getByText(/點歌者：amy/)).toBeInTheDocument();
  });

  it('點「插到最前面」呼叫 api.moveToFront 帶正確編號', () => {
    const state = {
      ...emptyQueueState(),
      items: [
        createSong('aaaaaaaaaaa', 'oscar', { songNumber: 1002 }),
        createSong('bbbbbbbbbbb', 'amy', { songNumber: 1003 }),
      ],
    };
    render(<QueueList state={state} />);
    fireEvent.click(screen.getByTestId('btn-move-front-1003'));
    expect(api.moveToFront).toHaveBeenCalledTimes(1);
    expect(api.moveToFront).toHaveBeenCalledWith(1003);
  });
});
