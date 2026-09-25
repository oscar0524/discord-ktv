import type { DiscordConfig } from '@discord-ktv/shared-types';

/**
 * BotConnection：管理 Discord 連線的熱重連狀態機。
 *
 * 設計：把「套用 config → 決定是否重連」的邏輯與真實 discord.js/網路副作用分離。
 * 副作用（login / destroy）以可注入依賴傳入，讓狀態機可用 mock 測試，不依賴真實 Gateway。
 *
 * 狀態轉換規則（applyConfig）：
 * - 無 token：進入待命；若目前已連線則先 destroy。
 * - 有 token 且與目前連線的 token 不同：先 destroy 舊連線，再用新 token login。
 * - 有 token 且與目前連線的 token 相同：不重連（避免無謂重連），僅更新 channelId。
 * - channelId 變更：更新內部 allowedChannel 過濾（不影響是否重連）。
 */
export interface BotConnectionDeps {
  /** 用指定 token 登入（建立/啟動 client 並連上 Gateway） */
  login: (token: string) => Promise<void>;
  /** 摧毀目前連線（登出並釋放 client） */
  destroy: () => Promise<void>;
  /** 記錄訊息（預設 console.log），抽出以便測試靜默 */
  log?: (message: string) => void;
}

export class BotConnection {
  /** 目前已成功登入所用的 token；null 表示待命（未連線） */
  private connectedToken: string | null = null;
  /** 目前允許的頻道 id；null 表示不限制 */
  private allowedChannel: string | null = null;

  constructor(private readonly deps: BotConnectionDeps) {}

  private log(message: string): void {
    (this.deps.log ?? ((m) => console.log(m)))(message);
  }

  /** 目前是否已連線（有 token 並登入成功） */
  isConnected(): boolean {
    return this.connectedToken !== null;
  }

  /** 目前允許的頻道 id（null 表示不限制） */
  getAllowedChannel(): string | null {
    return this.allowedChannel;
  }

  /**
   * 訊息頻道過濾：allowedChannel 為 null 時全部允許，否則須相符。
   * 供 message handler 綁定使用。
   */
  isChannelAllowed(channelId: string): boolean {
    return this.allowedChannel === null || this.allowedChannel === channelId;
  }

  /**
   * 套用新設定，必要時觸發熱重連。
   * @returns 本次是否實際重新登入（true 表示有 login 動作）
   */
  async applyConfig(config: DiscordConfig): Promise<boolean> {
    // channelId 一律先更新（不影響是否重連）
    const nextChannel = config.channelId?.trim() ? config.channelId.trim() : null;
    if (nextChannel !== this.allowedChannel) {
      this.allowedChannel = nextChannel;
      this.log(
        `[discord-bot] 頻道限制更新為 ${nextChannel ?? '（不限制）'}。`
      );
    }

    const token = config.token?.trim() ? config.token.trim() : null;

    // 無 token → 進入待命
    if (!token) {
      if (this.connectedToken !== null) {
        this.log('[discord-bot] 設定已清除 token，中止連線並進入待命。');
        await this.deps.destroy();
        this.connectedToken = null;
      } else {
        this.log('[discord-bot] 尚未設定 token，待命中（等待網頁設定）。');
      }
      return false;
    }

    // token 相同 → 不重連
    if (token === this.connectedToken) {
      return false;
    }

    // token 變更或首次連線 → 先 destroy 舊連線再 login
    if (this.connectedToken !== null) {
      this.log('[discord-bot] 偵測到 token 變更，重新連線…');
      await this.deps.destroy();
      this.connectedToken = null;
    }

    this.log('[discord-bot] 以新設定登入 Discord…');
    await this.deps.login(token);
    this.connectedToken = token;
    return true;
  }
}
