import crypto from "node:crypto";

/**
 * Verify a WeChat Work request signature.
 *
 * SHA1(sort([token, timestamp, nonce]).join("")) === msg_signature
 *
 * For GET URL-validation the same three-param formula is used.
 * For POST encrypted messages an optional fourth value (the Encrypt field)
 * may be included — pass it as `encrypt` to enable the four-param check.
 */
export function verifySignature(opts: {
  token:     string;
  timestamp: string;
  nonce:     string;
  signature: string;
  encrypt?:  string;  // include for the 4-param POST check
}): boolean {
  const parts = [opts.token, opts.timestamp, opts.nonce];
  if (opts.encrypt !== undefined) parts.push(opts.encrypt);

  const digest = crypto
    .createHash("sha1")
    .update(parts.sort().join(""))
    .digest("hex");

  return digest === opts.signature;
}
