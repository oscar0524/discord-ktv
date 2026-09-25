import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { api, type SaveDiscordConfigInput } from '../api/client';

/** channelId 前端基本驗證：純數字或空 */
function isChannelIdValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /^\d+$/.test(trimmed);
}

/**
 * Discord 設定對話框。
 *
 * 開啟時 GET /config/discord 顯示遮罩狀態（是否已設定 token、目前 channelId）。
 * token 欄位為密碼欄，留空表示不變更；channelId 做純數字/空的基本驗證。
 * 送出呼叫 PUT，成功後提示「設定已儲存，bot 將重新連線」。
 */
export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [channelError, setChannelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 開啟時載入目前遮罩狀態
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setToken('');
    setChannelError(null);
    api
      .getDiscordConfig()
      .then((status) => {
        if (cancelled) return;
        setHasToken(status.hasToken);
        setChannelId(status.channelId ?? '');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '讀取設定失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleChannelChange = (value: string): void => {
    setChannelId(value);
    setChannelError(
      isChannelIdValid(value) ? null : 'channelId 必須為純數字或留空'
    );
  };

  const handleSave = async (): Promise<void> => {
    if (!isChannelIdValid(channelId)) {
      setChannelError('channelId 必須為純數字或留空');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: SaveDiscordConfigInput = {
      channelId: channelId.trim() === '' ? null : channelId.trim(),
    };
    // token 留空表示不變更，不放進 payload
    if (token.trim() !== '') {
      payload.token = token.trim();
    }

    try {
      const status = await api.saveDiscordConfig(payload);
      setHasToken(status.hasToken);
      setToken('');
      setSuccess('設定已儲存，bot 將重新連線');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '儲存設定失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Discord 設定</DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-3 pt-1">
          <Typography variant="body2" color="text.secondary">
            {loading
              ? '載入中…'
              : hasToken
                ? 'Token 狀態：已設定（留空則不變更）'
                : 'Token 狀態：尚未設定'}
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <TextField
            label="Discord Token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? '留空表示不變更' : '貼上 bot token'}
            fullWidth
            disabled={loading || saving}
            inputProps={{ 'data-testid': 'input-token' }}
            autoComplete="off"
          />

          <TextField
            label="頻道 ID（Channel ID）"
            value={channelId}
            onChange={(e) => handleChannelChange(e.target.value)}
            placeholder="留空表示不限制頻道"
            fullWidth
            disabled={loading || saving}
            error={Boolean(channelError)}
            helperText={channelError ?? '純數字；留空表示不限制頻道'}
            inputProps={{ 'data-testid': 'input-channel' }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} data-testid="btn-cancel">
          關閉
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={loading || saving || Boolean(channelError)}
          data-testid="btn-save"
        >
          儲存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
