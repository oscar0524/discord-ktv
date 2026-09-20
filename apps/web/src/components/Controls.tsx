import { Button, Stack } from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api } from '../api/client';

/** 大螢幕上的播放控制按鈕（跳過 / 暫停 / 繼續） */
export function Controls({ isPaused }: { isPaused: boolean }) {
  return (
    <Stack direction="row" spacing={2}>
      <Button
        variant="contained"
        startIcon={<SkipNextIcon />}
        onClick={() => void api.skip()}
        data-testid="btn-skip"
      >
        跳過
      </Button>
      {isPaused ? (
        <Button
          variant="outlined"
          startIcon={<PlayArrowIcon />}
          onClick={() => void api.play()}
          data-testid="btn-play"
        >
          繼續
        </Button>
      ) : (
        <Button
          variant="outlined"
          startIcon={<PauseIcon />}
          onClick={() => void api.pause()}
          data-testid="btn-pause"
        >
          暫停
        </Button>
      )}
    </Stack>
  );
}
