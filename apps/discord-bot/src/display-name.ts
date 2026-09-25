/**
 * 決定點歌者的顯示名稱（純函式，方便測試）。
 *
 * 優先序：server nickname / displayName → global display name → username。
 *
 * Discord.js 的 `GuildMember.displayName` 本身已含 nickname → globalName → username
 * 的 fallback 鏈，因此 guild 訊息直接帶入 `member.displayName` 即可滿足需求；
 * 當 member 缺失（DM 或未快取）時，呼叫端可傳 null，改由 globalName / username fallback。
 *
 * 空字串與純空白視為「未設定」，繼續往下 fallback。
 */
export function resolveDisplayName(input: {
  memberDisplayName?: string | null;
  globalName?: string | null;
  username: string;
}): string {
  const candidates = [input.memberDisplayName, input.globalName, input.username];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  // username 理論上一定存在；保底回傳原始 username。
  return input.username;
}
