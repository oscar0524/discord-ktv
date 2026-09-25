/** 前端與 api 溝通的設定與 REST 呼叫封裝。 */
import { ENV } from './env';

const API_URL = ENV.API_URL;

export const wsEndpoint = `${ENV.WS_URL}/ws`;

async function post(pathname: string): Promise<void> {
  await fetch(`${API_URL}${pathname}`, { method: 'POST' });
}

/** Discord 設定的遮罩狀態（GET /config/discord 回傳） */
export interface DiscordConfigStatus {
  hasToken: boolean;
  channelId: string | null;
}

/** 儲存 Discord 設定的 payload；token 省略表示不變更 */
export interface SaveDiscordConfigInput {
  token?: string;
  channelId?: string | null;
}

export const api = {
  skip: () => post('/control/skip'),
  pause: () => post('/control/pause'),
  play: () => post('/control/play'),
  /** 大螢幕播完一首時呼叫，推進到下一首 */
  playbackEnded: () => post('/playback/ended'),

  /** 取得 Discord 設定的遮罩狀態（不含明文 token） */
  async getDiscordConfig(): Promise<DiscordConfigStatus> {
    const res = await fetch(`${API_URL}/config/discord`);
    if (!res.ok) {
      throw new Error(`讀取設定失敗（${res.status}）`);
    }
    return (await res.json()) as DiscordConfigStatus;
  },

  /** 儲存 Discord 設定；成功後 bot 會熱重連。 */
  async saveDiscordConfig(
    input: SaveDiscordConfigInput
  ): Promise<DiscordConfigStatus> {
    const res = await fetch(`${API_URL}/config/discord`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      let message = `儲存設定失敗（${res.status}）`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // 忽略非 JSON 錯誤回應
      }
      throw new Error(message);
    }
    return (await res.json()) as DiscordConfigStatus;
  },
};
