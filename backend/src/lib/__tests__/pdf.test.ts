import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePdfBytes } from "@/lib/ai/pdf";

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

  it("页数超过上限时拒绝", async () => {
    await expect(parsePdfBytes(fixture("too-many-pages.pdf"))).rejects.toThrow(
      /页数超过上限/
    );
  });

  it("无效 PDF 抛可读错误", async () => {
    await expect(parsePdfBytes(new Uint8Array([1, 2, 3, 4, 5]).buffer)).rejects.toThrow();
  });
});
