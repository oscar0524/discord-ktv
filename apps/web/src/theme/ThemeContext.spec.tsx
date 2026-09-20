import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useThemeMode } from './ThemeContext';

function Probe() {
  const { mode } = useThemeMode();
  return <div data-testid="mode">{mode}</div>;
}

function ToggleButton() {
  const { toggle } = useThemeMode();
  return (
    <button onClick={toggle} data-testid="toggle">
      toggle
    </button>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('預設為 light（無 localStorage、系統非 dark）', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('切換後 mode 變 dark，<html> 帶上 dark class 並寫入 localStorage', () => {
    render(
      <ThemeProvider>
        <Probe />
        <ToggleButton />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByTestId('toggle'));

    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('ktv-theme-mode')).toBe('dark');
  });

  it('讀取 localStorage 既有值作為初始模式', () => {
    window.localStorage.setItem('ktv-theme-mode', 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
