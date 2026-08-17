import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePdfBytes, PdfUserError } from "@/lib/ai/pdf";

function fixture(name: string): ArrayBuffer {
  const buf = readFileSync(join(import.meta.dirname, "fixtures", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("parsePdfBytes", () => {
  it("提取文本型 PDF 的文本", async () => {
    const text = await parsePdfBytes(fixture("sample.pdf"));
    expect(text).toContain("Page 1 of sample fixture.");
    expect(text).toContain("Page 3 of sample fixture.");
  });

  it("页数超过上限时抛 PdfUserError（白名单文案）", async () => {
    await expect(parsePdfBytes(fixture("too-many-pages.pdf"))).rejects.toMatchObject({
      name: "PdfUserError",
      message: expect.stringMatching(/页数超过上限/),
    });
  });

  it("无效 PDF 抛 PdfUserError 且不泄漏内部细节", async () => {
    const err = await parsePdfBytes(new Uint8Array([1, 2, 3, 4, 5]).buffer).catch((e) => e);
    expect(err).toBeInstanceOf(PdfUserError);
    // 只回显白名单文案，不包含底层解析器的内部信息（如路径/堆栈）
    expect(err.message).toBe("PDF 解析失败（文件可能损坏或格式不受支持）");
    expect(err.message).not.toMatch(/node_modules|\.js|at |Error:/);
  });
});
