import {
  AppBar,
  Box,
  Chip,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import { ThemeToggle } from './components/ThemeToggle';
import { Player } from './components/Player';
import { Controls } from './components/Controls';
import { QueueList } from './components/QueueList';
import { useQueue } from './api/useQueue';

/** KTV 大螢幕主頁：播放器 + 控制 + 待播清單 + 日夜切換。 */
export function App() {
  const { state, connected } = useQueue();

  return (
    <Box className="min-h-screen">
      <AppBar position="static" color="default" enableColorOnDark>
        <Toolbar className="gap-3">
          <Typography variant="h6" className="flex-1">
            🎤 Discord KTV
          </Typography>
          <Chip
            size="small"
            label={connected ? '已連線' : '連線中…'}
            color={connected ? 'success' : 'default'}
            data-testid="conn-status"
          />
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="py-6">
        <Box className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Box className="flex flex-col gap-4 md:col-span-2">
            <Player current={state.current} />
            <Box className="flex items-center justify-between">
              <Typography variant="subtitle1">
                {state.current
                  ? `播放中：${state.current.title ?? state.current.videoId}`
                  : '尚無播放中的歌曲'}
              </Typography>
              <Controls isPaused={state.isPaused} />
            </Box>
          </Box>
          <Box className="md:col-span-1">
            <QueueList state={state} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
