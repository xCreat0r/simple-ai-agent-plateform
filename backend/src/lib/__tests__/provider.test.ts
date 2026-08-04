import { describe, it, expect } from "vitest";
import { getModelForAgent } from "@/lib/ai/provider";

describe("getModelForAgent", () => {
  it("已知模型返回对应 provider", () => {
    expect(getModelForAgent("deepseek-v4-flash")).toEqual({
      model: "deepseek-v4-flash",
      provider: "deepseek",
    });
  });

  it("未知模型回退到 deepseek-v4-flash", () => {
    expect(getModelForAgent("gpt-4")).toEqual({
      model: "deepseek-v4-flash",
      provider: "deepseek",
    });
  });
});
