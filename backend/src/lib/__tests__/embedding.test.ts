import { describe, it, expect } from "vitest";
import { generateEmbedding } from "@/lib/ai/embedding";

describe("generateEmbedding (mock provider)", () => {
  it("相同文本生成相同向量", async () => {
    const a = await generateEmbedding("你好");
    const b = await generateEmbedding("你好");
    expect(a).toEqual(b);
  });

  it("不同文本生成不同向量", async () => {
    const a = await generateEmbedding("你好");
    const b = await generateEmbedding("再见");
    expect(a).not.toEqual(b);
  });

  it("返回 1024 维向量", async () => {
    const vec = await generateEmbedding("测试");
    expect(vec).toHaveLength(1024);
  });

  it("向量为单位向量", async () => {
    const vec = await generateEmbedding("测试");
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});
