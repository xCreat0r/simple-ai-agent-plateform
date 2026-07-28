import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("合并多个类名", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("过滤 falsy 值", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("tailwind 冲突去重", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("空输入返回空字符串", () => {
    expect(cn()).toBe("");
  });
});
