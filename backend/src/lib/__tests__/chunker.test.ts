import { describe, it, expect } from "vitest";
import { splitText } from "@/lib/ai/chunker";

describe("splitText", () => {
  it("空文本返回空数组", () => {
    expect(splitText("")).toEqual([]);
    expect(splitText("\n\n\n\n")).toEqual([]);
  });

  it("短段落直接成块", () => {
    expect(splitText("你好")).toEqual(["你好"]);
  });

  it("多个短段落合并为一块", () => {
    const text = "第一段\n\n第二段";
    expect(splitText(text)).toEqual(["第一段\n\n第二段"]);
  });

  it("合并后超过上限时拆成多块", () => {
    const para = "字".repeat(400);
    const text = [para, para, para].join("\n\n");
    const chunks = splitText(text);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe(para);
  });

  it("超长段落按句子切分且内容完整无重复", () => {
    const sentence = "这是一段很长的测试文本，用于验证分块算法的边界行为。";
    const text = sentence.repeat(50);
    const chunks = splitText(text);
    // 句子块按 800 字上限切分，不再产生与上一块内容重复的尾巴块
    expect(chunks.length).toBe(2);
    expect(chunks.join("")).toBe(text);
  });

  it("长段落之间的 overlap 尾巴拼入下一块开头", () => {
    const sentence = "这是一段很长的测试文本，用于验证分块算法的边界行为。";
    const text = sentence.repeat(50) + "\n\n" + sentence.repeat(50);
    const chunks = splitText(text);
    // 两个超长段落，各自切分为两块，无独立尾巴块
    expect(chunks.length).toBe(4);
    // 第二段第一块以第一段末尾 100 字衔接开头
    expect(chunks[2].startsWith(sentence.repeat(50).slice(-100))).toBe(true);
    expect(chunks[0].endsWith("边界行为。")).toBe(true);
  });

  it("段与段之间保留 overlap 尾衔接", () => {
    const sentence = "阿".repeat(10) + "。";
    const bigPara = sentence.repeat(80);
    const smallPara = "小尾巴";
    const chunks = splitText(`${bigPara}\n\n${smallPara}`);
    expect(chunks.at(-1)?.endsWith(smallPara)).toBe(true);
  });

  it("过滤空白分块", () => {
    const chunks = splitText("正文\n\n\n\n结尾");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });
});
