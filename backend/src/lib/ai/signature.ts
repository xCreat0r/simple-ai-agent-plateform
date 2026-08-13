import { getCloudflareContext } from "@/lib/env-holder";

// HMAC-SHA256 请求签名（与 base 服务校验逻辑严格一致）。
// 签名串: {timestamp}\n{nonce}\n{sha256Hex(body)}\n{path}
// 请求头: X-Api-Key / X-Timestamp / X-Nonce / X-Signature

let cachedHmacKey: CryptoKey | null = null;
let cachedHmacSecret = "";

// hex 编码：字节循环转小写 hex，不依赖 Buffer
function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

// HMAC key 按 secret 缓存，避免每次请求重复 importKey
async function getHmacKey(secret: string): Promise<CryptoKey> {
  if (!cachedHmacKey || cachedHmacSecret !== secret) {
    cachedHmacSecret = secret;
    cachedHmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return cachedHmacKey;
}

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toHex(sig);
}

export interface BaseSignature {
  key: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

// 生成 base 服务请求签名所需的四个头。
// 缺 BASE_SERVICE_KEY / BASE_SERVICE_SECRET 时抛可读错误。
export async function signBaseRequest(body: ArrayBuffer, path: string): Promise<BaseSignature> {
  const { env } = getCloudflareContext();
  const key = env.BASE_SERVICE_KEY || process.env.BASE_SERVICE_KEY;
  const secret = env.BASE_SERVICE_SECRET || process.env.BASE_SERVICE_SECRET;
  if (!key || !secret) {
    throw new Error("未配置 BASE_SERVICE_KEY / BASE_SERVICE_SECRET，无法调用 PDF 解析服务");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(body);
  const stringToSign = `${timestamp}\n${nonce}\n${bodyHash}\n${path}`;
  const signature = await hmacSha256Hex(secret, stringToSign);

  return { key, timestamp, nonce, signature };
}
