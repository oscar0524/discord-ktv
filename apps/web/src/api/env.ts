/**
 * 集中讀取 Vite 環境變數。
 * 抽成獨立檔案，測試時以 __mocks__/env.ts 取代，避免 jest(CJS) 無法解析 import.meta。
 */
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333',
  WS_URL: import.meta.env.VITE_WS_URL ?? 'ws://localhost:3333',
};
