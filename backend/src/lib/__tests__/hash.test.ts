import { describe, it, expect } from "vitest";
import { sha256HexString } from "@/lib/util/hash";

describe("sha256HexString", () => {
  it("输出 64 位小写 hex，且结果确定", async () => {
    const a = await sha256HexString("hello");
    const b = await sha256HexString("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("不同输入得到不同摘要", async () => {
    const a = await sha256HexString("token-a");
    const b = await sha256HexString("token-b");
    expect(a).not.toBe(b);
  });
});
