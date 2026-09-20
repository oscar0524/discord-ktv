import { IconButton, Tooltip } from '@mui/material';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { useThemeMode } from '../theme/ThemeContext';

/** 日夜主題切換按鈕（太陽 / 月亮） */
export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <Tooltip title={isDark ? '切換為日間' : '切換為夜間'}>
      <IconButton
        onClick={toggle}
        color="inherit"
        aria-label="切換日夜主題"
        data-testid="theme-toggle"
      >
        {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
      </IconButton>
    </Tooltip>
  );
}
