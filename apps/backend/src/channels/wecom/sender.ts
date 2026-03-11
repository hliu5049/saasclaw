// ── WeChat Work (企业微信) outbound message sender ───────────────────────────
// Docs: https://developer.work.weixin.qq.com/document/path/90236

export interface WecomChannelConfig {
  corpId:          string;
  corpSecret:      string;
  /** WeChat Work application agentid (integer) */
  agentId:         string | number;
  /** Verification token */
  token:           string;
  /** 44-char base64 AES key */
  encodingAESKey:  string;
}

// ── Access-token cache ────────────────────────────────────────────────────────

interface TokenEntry { value: string; expiresAt: number }
const tokenCache = new Map<string, TokenEntry>();

async function getAccessToken(corpId: string, corpSecret: string): Promise<string> {
  const key    = `${corpId}:${corpSecret}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`;
  const res  = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?:   number;
    errcode?:      number;
    errmsg?:       string;
  };

  if (!data.access_token) {
    throw new Error(`WeChat Work gettoken failed: errcode=${data.errcode} ${data.errmsg ?? ""}`);
  }

  tokenCache.set(key, {
    value:     data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 7200) - 60) * 1000, // 1 min buffer
  });

  return data.access_token;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Push a text message to a WeChat Work user.
 *
 * @param config  Channel configuration (corpId, corpSecret, agentId, …)
 * @param toUser  Target user's WeChat Work openid (FromUserName from incoming msg)
 * @param text    Plain text content to send (≤ 2048 chars recommended)
 */
export async function sendWecomText(
  config: WecomChannelConfig,
  toUser: string,
  text:   string,
): Promise<void> {
  const token = await getAccessToken(config.corpId, config.corpSecret);
  const url   = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

  const res  = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      touser:  toUser,
      msgtype: "text",
      agentid: Number(config.agentId),
      text:    { content: text },
      safe:    0,
    }),
  });

  const data = (await res.json()) as { errcode?: number; errmsg?: string };
  if (data.errcode !== 0) {
    throw new Error(`WeChat Work send failed: errcode=${data.errcode} ${data.errmsg ?? ""}`);
  }
}
