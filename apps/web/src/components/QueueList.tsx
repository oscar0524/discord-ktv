import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import type { QueueState } from '@discord-ktv/shared-types';

/** 側邊待播清單 */
export function QueueList({ state }: { state: QueueState }) {
  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="h6">待播清單</Typography>
      <Divider />
      {state.items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          目前沒有待播歌曲，在 Discord 貼上 YouTube 連結即可點歌。
        </Typography>
      ) : (
        <List dense data-testid="queue-list">
          {state.items.map((song, index) => (
            <ListItem key={song.id} divider>
              <ListItemText
                primary={`${index + 1}. ${song.title ?? song.videoId}`}
                secondary={`點歌者：${song.requestedBy}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
