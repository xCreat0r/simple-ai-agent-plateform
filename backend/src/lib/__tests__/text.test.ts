import { describe, it, expect } from "vitest";
import { overlapRatio, deduplicateChunks } from "@/lib/util/text";

describe("overlapRatio", () => {
  it("空串返回 0", () => {
    expect(overlapRatio("", "abc")).toBe(0);
  });

  it("完全相同的文本返回 1", () => {
    expect(overlapRatio("abc", "abc")).toBe(1);
  });

  it("部分重叠以较长文本为分母", () => {
    expect(overlapRatio("abc", "abcd")).toBe(0.75);
  });

  it("完全不重叠返回 0", () => {
    expect(overlapRatio("hello world", "foo bar")).toBeLessThanOrEqual(0.7);
  });
});

describe("deduplicateChunks", () => {
  it("过滤完全相同与高度相似的分块", () => {
    const chunks = [
      "今天天气很好，适合出门散步。",
      "今天天气很好，适合出门散步。",
      "完全不同的内容xyz",
    ];
    const result = deduplicateChunks(chunks);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(chunks[0]);
    expect(result[1]).toBe(chunks[2]);
  });

  it("保留不相似的分块", () => {
    const chunks = ["hello world", "foo bar"];
    expect(deduplicateChunks(chunks)).toEqual(chunks);
  });
});
