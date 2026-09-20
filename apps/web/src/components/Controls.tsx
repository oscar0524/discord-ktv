import { Button, IconButton, Stack, Tooltip } from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { api } from '../api/client';

/**
 * 大螢幕上的播放控制按鈕（跳過 / 暫停 / 繼續）。
 *
 * collapsed=true 時只顯示 icon（放在收合狀態的側欄軌道），
 * collapsed=false 時顯示帶文字的完整按鈕。
 */
export function Controls({
  isPaused,
  collapsed = false,
}: {
  isPaused: boolean;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <Stack direction="column" spacing={1} alignItems="center">
        <Tooltip title="跳過" placement="left">
          <IconButton
            color="primary"
            onClick={() => void api.skip()}
            aria-label="跳過"
            data-testid="btn-skip"
          >
            <SkipNextIcon />
          </IconButton>
        </Tooltip>
        {isPaused ? (
          <Tooltip title="繼續" placement="left">
            <IconButton
              onClick={() => void api.play()}
              aria-label="繼續"
              data-testid="btn-play"
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="暫停" placement="left">
            <IconButton
              onClick={() => void api.pause()}
              aria-label="暫停"
              data-testid="btn-pause"
            >
              <PauseIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  }

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
