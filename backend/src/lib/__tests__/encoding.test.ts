import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { decodeTextBuffer } from "@/lib/util/encoding";

// node 类型中 Uint8Array/Buffer 的 .buffer 为 ArrayBufferLike，
// 这里统一转成精确长度的 ArrayBuffer
function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy.buffer as ArrayBuffer;
}

describe("decodeTextBuffer", () => {
  it("解码 UTF-8 文本", () => {
    const buf = toArrayBuffer(new TextEncoder().encode("你好，世界"));
    expect(decodeTextBuffer(buf)).toBe("你好，世界");
  });

  it("解码 GBK 编码的文本", () => {
    const buf = toArrayBuffer(iconv.encode("中文 GBK 测试", "gbk"));
    expect(decodeTextBuffer(buf)).toBe("中文 GBK 测试");
  });

  it("解码纯 ASCII 文本", () => {
    const buf = toArrayBuffer(new TextEncoder().encode("hello world"));
    expect(decodeTextBuffer(buf)).toBe("hello world");
  });
});
