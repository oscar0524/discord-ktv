import { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useDanmaku } from '../danmaku/DanmakuContext';
import { useDanmakuFeed, type DanmakuItem } from '../api/useDanmakuFeed';

/** 彈幕動畫時間（秒），需與 CSS keyframes 使用時間一致 */
export const DANMAKU_DURATION_S = 5;
/** 上方 1/3 切成幾條軌道（lane） */
export const DANMAKU_LANES = 4;

/** 畫面上一則正在飄的彈幕（含指定的軌道） */
interface ActiveDanmaku extends DanmakuItem {
  /** 軌道索引（0 ~ DANMAKU_LANES-1） */
  lane: number;
}

/**
 * 挑選一條軌道：選「最久沒被使用」的軌道，讓相鄰彈幕盡量不重疊。
 * lastUsed 記錄各軌道最後進入時間（epoch millis），未使用者視為 0。
 */
function pickLane(lastUsed: number[]): number {
  let lane = 0;
  let oldest = Infinity;
  for (let i = 0; i < lastUsed.length; i++) {
    const t = lastUsed[i] ?? 0;
    if (t < oldest) {
      oldest = t;
      lane = i;
    }
  }
  return lane;
}

/**
 * 彈幕覆蓋層：絕對定位覆蓋 player 上方 1/3，pointer-events: none、overflow: hidden。
 * 收到新彈幕就挑一條軌道加入 active 陣列，用 CSS 動畫從右到左飄 5s，
 * onAnimationEnd 後移除。開關關閉（enabled=false）時不渲染任何彈幕並清空 active。
 *
 * feed 預設用 useDanmakuFeed，可在測試注入替身。
 */
export function DanmakuOverlay({
  feed = useDanmakuFeed,
}: {
  feed?: typeof useDanmakuFeed;
}) {
  const { enabled } = useDanmaku();
  const [active, setActive] = useState<ActiveDanmaku[]>([]);
  // 各軌道最後進入時間
  const laneLastUsed = useRef<number[]>(new Array(DANMAKU_LANES).fill(0));

  const handleDanmaku = useCallback(
    (item: DanmakuItem) => {
      const lastUsed = laneLastUsed.current;
      const lane = pickLane(lastUsed);
      lastUsed[lane] = Date.now();
      setActive((prev) => [...prev, { ...item, lane }]);
    },
    []
  );

  feed(handleDanmaku);

  const removeItem = useCallback((id: string) => {
    setActive((prev) => prev.filter((d) => d.id !== id));
  }, []);

  if (!enabled) {
    // 關閉時清空，避免重新開啟時殘留
    if (active.length > 0) setActive([]);
    return null;
  }

  return (
    <Box
      data-testid="danmaku-overlay"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '33.333%',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 10,
      }}
    >
      {active.map((d) => (
        <Box
          key={d.id}
          data-testid="danmaku-item"
          onAnimationEnd={() => removeItem(d.id)}
          sx={{
            position: 'absolute',
            top: `${(d.lane / DANMAKU_LANES) * 100}%`,
            // 起點貼容器右緣外側；動畫接手後接管 left/transform。
            left: '100%',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            fontSize: '1.5rem',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6)',
            willChange: 'transform',
            animation: `ktv-danmaku-scroll ${DANMAKU_DURATION_S}s linear forwards`,
          }}
        >
          {d.text}
        </Box>
      ))}
    </Box>
  );
}
