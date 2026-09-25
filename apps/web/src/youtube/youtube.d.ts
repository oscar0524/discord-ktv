/// <reference types="youtube" />

/**
 * @types/youtube 只宣告全域 `YT` namespace，但沒有把 IFrame API 放到 window 上的
 * 兩個進入點：`window.YT` 與 `window.onYouTubeIframeAPIReady`。
 * 這裡補上最小 augmentation，供 provider 動態注入 script、等待 API 就緒使用。
 */
declare global {
  interface Window {
    /** IFrame API 就緒後由 script 掛上的全域物件。 */
    YT?: typeof YT;
    /** IFrame API 載入完成時的回呼；由 provider 設定。 */
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
