import { render, screen } from '@testing-library/react';
import { createSong, emptyQueueState } from '@discord-ktv/shared-types';
import { QueueList } from './QueueList';

describe('QueueList', () => {
  it('空清單顯示提示文字', () => {
    render(<QueueList state={emptyQueueState()} />);
    expect(screen.getByText(/沒有待播歌曲/)).toBeInTheDocument();
  });

  it('渲染待播歌曲與點歌者', () => {
    const state = {
      ...emptyQueueState(),
      items: [
        createSong('aaaaaaaaaaa', 'oscar', { title: '稻香' }),
        createSong('bbbbbbbbbbb', 'amy'),
      ],
    };
    render(<QueueList state={state} />);
    expect(screen.getByTestId('queue-list')).toBeInTheDocument();
    expect(screen.getByText(/稻香/)).toBeInTheDocument();
    expect(screen.getByText(/點歌者：oscar/)).toBeInTheDocument();
    expect(screen.getByText(/點歌者：amy/)).toBeInTheDocument();
  });
});
