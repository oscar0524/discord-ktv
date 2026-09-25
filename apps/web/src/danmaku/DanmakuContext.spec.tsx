import { render, screen, fireEvent } from '@testing-library/react';
import { DanmakuProvider, useDanmaku } from './DanmakuContext';

function Probe() {
  const { enabled } = useDanmaku();
  return <div data-testid="enabled">{String(enabled)}</div>;
}

function ToggleButton() {
  const { toggle } = useDanmaku();
  return (
    <button onClick={toggle} data-testid="toggle">
      toggle
    </button>
  );
}

describe('DanmakuContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('預設為 enabled=true（無 localStorage）', () => {
    render(
      <DanmakuProvider>
        <Probe />
      </DanmakuProvider>
    );
    expect(screen.getByTestId('enabled').textContent).toBe('true');
  });

  it('toggle 後變 false 並寫入 localStorage', () => {
    render(
      <DanmakuProvider>
        <Probe />
        <ToggleButton />
      </DanmakuProvider>
    );
    fireEvent.click(screen.getByTestId('toggle'));

    expect(screen.getByTestId('enabled').textContent).toBe('false');
    expect(window.localStorage.getItem('ktv-danmaku-enabled')).toBe('false');
  });

  it('已有 localStorage 值時以其為準（false）', () => {
    window.localStorage.setItem('ktv-danmaku-enabled', 'false');
    render(
      <DanmakuProvider>
        <Probe />
      </DanmakuProvider>
    );
    expect(screen.getByTestId('enabled').textContent).toBe('false');
  });
});
