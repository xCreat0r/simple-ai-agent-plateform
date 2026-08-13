import { describe, it, expect, afterEach } from "vitest";
import { boolEnv } from "@/lib/config";

// boolEnv 为安全关键逻辑：ALLOW_SIGNUP 未配置时必须默认关闭注册
describe("boolEnv", () => {
  afterEach(() => {
    delete process.env.__TEST_BOOL_ENV__;
  });

  it("未配置时返回 fallback", () => {
    expect(boolEnv("__TEST_BOOL_ENV__", false)).toBe(false);
  });

  it("'true' 解析为 true", () => {
    process.env.__TEST_BOOL_ENV__ = "true";
    expect(boolEnv("__TEST_BOOL_ENV__", false)).toBe(true);
  });

  it("'false' 解析为 false", () => {
    process.env.__TEST_BOOL_ENV__ = "false";
    expect(boolEnv("__TEST_BOOL_ENV__", true)).toBe(false);
  });

  it("大小写不敏感", () => {
    process.env.__TEST_BOOL_ENV__ = "TRUE";
    expect(boolEnv("__TEST_BOOL_ENV__", false)).toBe(true);
  });

  it("空串回退到 fallback", () => {
    process.env.__TEST_BOOL_ENV__ = "  ";
    expect(boolEnv("__TEST_BOOL_ENV__", false)).toBe(false);
  });

  it("非 true 的任意值视为关闭", () => {
    process.env.__TEST_BOOL_ENV__ = "yes";
    expect(boolEnv("__TEST_BOOL_ENV__", true)).toBe(false);
  });
});
