import { useEffect, useState } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QueueState, Song } from '@discord-ktv/shared-types';
import { api } from '../api/client';

/** 單一可拖曳的待播列。 */
function SortableSongItem({
  song,
  index,
  onMoveToFront,
}: {
  song: Song;
  index: number;
  onMoveToFront: (songNumber: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      divider
      data-testid={`queue-item-${song.id}`}
      secondaryAction={
        <Tooltip title="插到最前面">
          <IconButton
            edge="end"
            size="small"
            aria-label={`把編號 ${song.songNumber} 插到最前面`}
            data-testid={`btn-move-front-${song.songNumber}`}
            onClick={() => onMoveToFront(song.songNumber)}
          >
            <VerticalAlignTopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', mr: 1 }}
        aria-label="拖曳排序"
        data-testid={`drag-handle-${song.id}`}
      >
        <DragIndicatorIcon fontSize="small" color="disabled" />
      </Box>
      <ListItemText
        primary={`${index + 1}. 編號 ${song.songNumber}｜${song.title ?? song.videoId}`}
        secondary={`點歌者：${song.requestedBy}`}
      />
    </ListItem>
  );
}

/**
 * 側邊待播清單。
 *
 * 顯示以 useQueue 廣播回來的 state 為權威來源；拖曳過程用本地暫態 order 呈現，
 * 拖放結束後以新順序的 id 陣列呼叫 api.reorder，等待後端廣播覆蓋本地狀態。
 * 「插到最前面」按鈕呼叫 api.moveToFront(songNumber)。
 * 拖曳只作用於 items（不含 current）。
 */
export function QueueList({ state }: { state: QueueState }) {
  // 本地暫態：拖曳時立即反映順序，隨後端廣播（state.items 變動）重新同步
  const [items, setItems] = useState<Song[]>(state.items);

  useEffect(() => {
    setItems(state.items);
  }, [state.items]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // 樂觀更新，等待後端廣播覆蓋
    void api.reorder(next.map((s) => s.id));
  };

  const handleMoveToFront = (songNumber: number): void => {
    void api.moveToFront(songNumber);
  };

  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="h6">待播清單</Typography>
      <Divider />
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          目前沒有待播歌曲，在 Discord 貼上 YouTube 連結即可點歌。
        </Typography>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <List dense data-testid="queue-list">
              {items.map((song, index) => (
                <SortableSongItem
                  key={song.id}
                  song={song}
                  index={index}
                  onMoveToFront={handleMoveToFront}
                />
              ))}
            </List>
          </SortableContext>
        </DndContext>
      )}
    </Box>
  );
}
