import { describe, it, expect } from "vitest";
import { encryptPdf } from "@/lib/ai/encrypt";

// 固定密钥/明文/nonce 的可复现 golden vector，
// 与 services/base/tests/test_crypto.py 中的向量一致，用于跨语言（WebCrypto ↔ Python cryptography）兼容校验。
const KEY_B64 = "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s="; // 32 字节 0xAB
const NONCE = new Uint8Array(12).fill(0x07);
const PLAIN_BUF = new TextEncoder().encode("hello pdf").buffer as ArrayBuffer;
const GOLDEN_HEX = "070707070707070707070707c5c1b118636791912cc4b66d6610c2c7f80558ee18ca002f3c";

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("encryptPdf", () => {
  it("golden vector 与 base 端 Python 解密约定一致", async () => {
    const out = await encryptPdf(PLAIN_BUF, KEY_B64, NONCE);
    expect(toHex(out)).toBe(GOLDEN_HEX);
  });

  it("密文长度 = 明文 + 12(nonce) + 16(tag)", async () => {
    const out = await encryptPdf(PLAIN_BUF, KEY_B64, NONCE);
    expect(out.byteLength).toBe(PLAIN_BUF.byteLength + 12 + 16);
  });

  it("未传 nonce 时每次生成不同 nonce", async () => {
    const a = await encryptPdf(PLAIN_BUF, KEY_B64);
    const b = await encryptPdf(PLAIN_BUF, KEY_B64);
    expect(a.byteLength).toBe(b.byteLength);
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it("密钥长度非法时报错", async () => {
    await expect(encryptPdf(PLAIN_BUF, "c2hvcnQ=")).rejects.toThrow("32 字节");
  });
});
