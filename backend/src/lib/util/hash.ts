// 通用字符串哈希工具（Web Crypto，无依赖）

// 字节循环转小写 hex
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

// SHA-256 十六进制摘要：用于 refresh token 等敏感凭据的落库存储，
// 避免数据库泄露时直接拿到可用的明文令牌
export async function sha256HexString(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}
