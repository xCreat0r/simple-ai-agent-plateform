import { describe, it, expect } from "vitest";
import { parseBody } from "@/lib/validate";
import { createAgentSchema } from "@/lib/validators";

describe("parseBody", () => {
  it("合法数据返回解析结果", () => {
    const data = parseBody({ name: "助手" }, createAgentSchema);
    expect(data.name).toBe("助手");
  });

  it("非法数据抛出 400 响应", async () => {
    try {
      parseBody({ name: "" }, createAgentSchema);
      throw new Error("应当抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(400);
      const body = await (err as Response).json() as { error: string };
      expect(typeof body.error).toBe("string");
      expect((body.error as string).length).toBeGreaterThan(0);
    }
  });
});
