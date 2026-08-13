import { getCloudflareContext } from "@/lib/env-holder";

// 应用层加密：用 AES-256-GCM 加密 PDF 字节，防止公网链路明文嗅探。
// 密钥 PDF_ENCRYPTION_KEY 为 base64 编码的 32 字节，Worker 与 base 服务配置同一把。
// 传输格式: nonce(12) || ciphertext || tag(16)，与 base 端 Python cryptography AESGCM 兼容。
// 未配置密钥时返回 undefined，调用方按明文传输（兼容/回滚）。

const NONCE_LENGTH = 12;

export function getPdfEncryptionKey(): string | undefined {
  const { env } = getCloudflareContext();
  return env.PDF_ENCRYPTION_KEY || process.env.PDF_ENCRYPTION_KEY;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// nonce 可选传入用于可复现测试（golden vector）；默认每次随机生成
export async function encryptPdf(
  plaintext: ArrayBuffer,
  keyB64: string,
  nonce?: Uint8Array
): Promise<ArrayBuffer> {
  const keyBytes = base64ToBytes(keyB64);
  if (keyBytes.length !== 32) {
    throw new Error("PDF_ENCRYPTION_KEY 必须是 base64 编码的 32 字节密钥");
  }

  const iv = nonce ?? crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  // WebCrypto encrypt 返回的密文末尾已附加 16 字节 GCM tag
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.length);
  return out.buffer;
}
