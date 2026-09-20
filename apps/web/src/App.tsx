import { useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { ThemeToggle } from './components/ThemeToggle';
import { Player } from './components/Player';
import { Controls } from './components/Controls';
import { QueueList } from './components/QueueList';
import { useQueue } from './api/useQueue';

const SIDEBAR_WIDTH = 340;
const SIDEBAR_COLLAPSED_WIDTH = 56;

/** KTV 大螢幕主頁：主內容 + 右側可收折側欄（整合原 AppBar 與待播清單）。 */
export function App() {
  const { state, connected } = useQueue();
  // 側欄預設折起來
  const [open, setOpen] = useState(false);

  const sidebarWidth = open ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <Box sx={{ height: '100vh', overflow: 'hidden' }}>
      {/* 主內容區：寬度 = 100% - 側欄寬度，隨側欄收折自動填滿 */}
      <Box
        component="main"
        className="py-6 px-4 md:px-8 flex flex-col gap-4"
        sx={{
          transition: 'width 0.2s',
          width: `calc(100% - ${sidebarWidth}px)`,
          height: '100vh',
          overflowY: 'hidden',
        }}
      >
          <Box className="flex flex-col gap-1">
            <Typography
              variant="subtitle1"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {state.current
                ? `播放中：${state.current.title ?? state.current.videoId}（點歌：${state.current.requestedBy}）`
                : '尚無播放中的歌曲'}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {state.items.length > 0
                ? `下一首：${state.items[0].title ?? state.items[0].videoId}（點歌：${state.items[0].requestedBy}）`
                : '下一首：無'}
            </Typography>
          </Box>
          <Player current={state.current} isPaused={state.isPaused} />
        
      </Box>

      {/* 右側可收折側欄 */}
      <Drawer
        variant="permanent"
        anchor="right"
        PaperProps={{
          sx: {
            width: sidebarWidth,
            transition: 'width 0.2s',
            overflowX: 'hidden',
            height: '100vh',
          },
        }}
        sx={{ width: sidebarWidth, flexShrink: 0 }}
      >
        {/* 側欄頂部：收折鈕 + 標題（整合原 AppBar） */}
        <Box
          className="flex items-center gap-2 px-2 py-2"
          sx={{ minHeight: 56 }}
        >
          <Tooltip title={open ? '收合側欄' : '展開側欄'}>
            <IconButton
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? '收合側欄' : '展開側欄'}
              data-testid="sidebar-toggle"
            >
              {open ? <ChevronRightIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
          {open && (
            <Typography variant="h6" className="flex-1 whitespace-nowrap">
              🎤 Discord KTV
            </Typography>
          )}
        </Box>

        <Divider />

        {open ? (
          <Box className="flex flex-col gap-3 p-3 overflow-y-auto">
            <Box className="flex items-center gap-2">
              <Chip
                size="small"
                label={connected ? '已連線' : '連線中…'}
                color={connected ? 'success' : 'default'}
                data-testid="conn-status"
              />
              <Box className="flex-1" />
              <ThemeToggle />
            </Box>
            <Controls isPaused={state.isPaused} />
            <QueueList state={state} />
          </Box>
        ) : (
          // 收合時：控制鈕以 icon 形式顯示在側欄軌道上
          <Box className="flex flex-col items-center gap-2 py-2">
            <Controls isPaused={state.isPaused} collapsed />
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

export default App;
