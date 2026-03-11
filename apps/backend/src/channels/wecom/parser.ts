import crypto from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WecomMessage {
  FromUserName: string;
  ToUserName:   string;
  MsgType:      string;
  Content?:     string;
  MsgId?:       string;
  AgentID?:     string;
  CreateTime?:  string;
  Encrypt?:     string;   // present in outer envelope
}

// ── XML parsing (regex-based, WeChat Work XML is well-defined) ───────────────

export function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // CDATA fields: <Key><![CDATA[value]]></Key>
  const cdataRe = /<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = cdataRe.exec(xml)) !== null) {
    result[m[1]] = m[2];
  }

  // Plain text fields: <Key>value</Key>
  const plainRe = /<(\w+)>([^<]*)<\/\1>/g;
  while ((m = plainRe.exec(xml)) !== null) {
    if (!(m[1] in result)) result[m[1]] = m[2];
  }

  return result;
}

// ── AES-256-CBC decryption ────────────────────────────────────────────────────

/**
 * Decrypt a WeChat Work encrypted message.
 *
 * Key derivation:
 *   raw = Base64Decode(encodingAESKey + "=")   // 32 bytes
 *   iv  = raw[0..15]                            // first 16 bytes
 *
 * Decrypted payload layout:
 *   [ 16 random bytes | 4-byte BE msg length | UTF-8 message | corpId ]
 */
export function decryptMsg(encodingAESKey: string, encryptedBase64: string): string {
  const keyBuf = Buffer.from(encodingAESKey + "=", "base64"); // 32 bytes
  const iv     = keyBuf.slice(0, 16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
  decipher.setAutoPadding(false); // handle PKCS7 manually

  const raw = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);

  // Strip PKCS7 padding
  const padLen = raw[raw.length - 1];
  const plain  = raw.slice(0, raw.length - padLen);

  // Extract message content
  const msgLen = plain.readUInt32BE(16);
  const msg    = plain.slice(20, 20 + msgLen).toString("utf8");

  return msg;
}

/**
 * Full pipeline: decrypt the Encrypt field, then parse the inner XML.
 * Returns a WecomMessage populated from the decrypted payload.
 */
export function decryptAndParse(
  encodingAESKey: string,
  encryptedBase64: string,
): WecomMessage {
  const xml    = decryptMsg(encodingAESKey, encryptedBase64);
  const fields = parseXml(xml);

  return {
    FromUserName: fields.FromUserName ?? "",
    ToUserName:   fields.ToUserName   ?? "",
    MsgType:      fields.MsgType      ?? "",
    Content:      fields.Content,
    MsgId:        fields.MsgId,
    AgentID:      fields.AgentID,
    CreateTime:   fields.CreateTime,
  };
}
