/** 前端與 api 溝通的設定與 REST 呼叫封裝。 */
import { ENV } from './env';

const API_URL = ENV.API_URL;

export const wsEndpoint = `${ENV.WS_URL}/ws`;

async function post(pathname: string): Promise<void> {
  await fetch(`${API_URL}${pathname}`, { method: 'POST' });
}

export const api = {
  skip: () => post('/control/skip'),
  pause: () => post('/control/pause'),
  play: () => post('/control/play'),
  /** 大螢幕播完一首時呼叫，推進到下一首 */
  playbackEnded: () => post('/playback/ended'),
};
