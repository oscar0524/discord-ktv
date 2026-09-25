import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';
import { api } from '../api/client';

jest.mock('../api/client', () => ({
  api: {
    getDiscordConfig: jest.fn(),
    saveDiscordConfig: jest.fn(),
  },
}));

const mockedApi = api as unknown as {
  getDiscordConfig: jest.Mock;
  saveDiscordConfig: jest.Mock;
};

function tokenInput(): HTMLInputElement {
  return screen.getByTestId('input-token') as HTMLInputElement;
}
function channelInput(): HTMLInputElement {
  return screen.getByTestId('input-channel') as HTMLInputElement;
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getDiscordConfig.mockResolvedValue({
      hasToken: true,
      channelId: '123',
    });
    mockedApi.saveDiscordConfig.mockResolvedValue({
      hasToken: true,
      channelId: '123',
    });
  });

  it('開啟時載入並顯示遮罩狀態（已設定 token、目前 channelId）', async () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() =>
      expect(mockedApi.getDiscordConfig).toHaveBeenCalledTimes(1)
    );
    expect(screen.getByText(/已設定/)).toBeInTheDocument();
    await waitFor(() => expect(channelInput().value).toBe('123'));
  });

  it('channelId 非數字時擋下並提示，不呼叫 save', async () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() => expect(channelInput().value).toBe('123'));

    fireEvent.change(channelInput(), { target: { value: 'abc' } });
    expect(screen.getByText('channelId 必須為純數字或留空')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-save'));
    expect(mockedApi.saveDiscordConfig).not.toHaveBeenCalled();
  });

  it('正常送出：token 有填 → payload 含 token 與 channelId', async () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() => expect(channelInput().value).toBe('123'));

    fireEvent.change(tokenInput(), { target: { value: 'new-token' } });
    fireEvent.change(channelInput(), { target: { value: '456' } });
    fireEvent.click(screen.getByTestId('btn-save'));

    await waitFor(() =>
      expect(mockedApi.saveDiscordConfig).toHaveBeenCalledWith({
        token: 'new-token',
        channelId: '456',
      })
    );
    expect(await screen.findByText(/bot 將重新連線/)).toBeInTheDocument();
  });

  it('token 留空時 payload 不含 token', async () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() => expect(channelInput().value).toBe('123'));

    fireEvent.change(channelInput(), { target: { value: '789' } });
    fireEvent.click(screen.getByTestId('btn-save'));

    await waitFor(() =>
      expect(mockedApi.saveDiscordConfig).toHaveBeenCalledTimes(1)
    );
    const payload = mockedApi.saveDiscordConfig.mock.calls[0][0];
    expect(payload).toEqual({ channelId: '789' });
    expect('token' in payload).toBe(false);
  });

  it('channelId 留空時送出 channelId=null', async () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() => expect(channelInput().value).toBe('123'));

    fireEvent.change(channelInput(), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-save'));

    await waitFor(() =>
      expect(mockedApi.saveDiscordConfig).toHaveBeenCalledWith({
        channelId: null,
      })
    );
  });

  it('save 失敗時顯示錯誤訊息', async () => {
    mockedApi.saveDiscordConfig.mockRejectedValueOnce(
      new Error('儲存設定失敗（400）')
    );
    render(<SettingsDialog open onClose={() => undefined} />);
    await waitFor(() => expect(channelInput().value).toBe('123'));

    fireEvent.change(tokenInput(), { target: { value: 't' } });
    fireEvent.click(screen.getByTestId('btn-save'));

    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByText('儲存設定失敗（400）')
    ).toBeInTheDocument();
  });
});
