import { describe, it, expect } from "vitest";
import { createAgentSchema, createToolSchema, toolParametersSchema } from "@/lib/validators";

describe("createAgentSchema", () => {
  it("合法数据通过且默认值生效", () => {
    const data = createAgentSchema.parse({ name: "助手", systemPrompt: "你是一个助手" });
    expect(data.name).toBe("助手");
    expect(data.systemPrompt).toBe("你是一个助手");
    expect(data.model).toBe("deepseek-v4-flash");
    expect(data.temperature).toBe(0.7);
    expect(data.maxTokens).toBe(4096);
    expect(data.tools).toEqual([]);
    expect(data.knowledgeBaseIds).toEqual([]);
  });

  it("name 为空时失败", () => {
    expect(() => createAgentSchema.parse({ name: "" })).toThrow();
  });

  it("temperature 超出范围时失败", () => {
    expect(() => createAgentSchema.parse({ name: "x", temperature: 3 })).toThrow();
    expect(() => createAgentSchema.parse({ name: "x", temperature: -1 })).toThrow();
  });

  it("maxTokens 小于 1 时失败", () => {
    expect(() => createAgentSchema.parse({ name: "x", maxTokens: 0 })).toThrow();
  });
});

describe("createToolSchema", () => {
  it("合法工具定义通过", () => {
    const data = createToolSchema.parse({
      name: "天气查询",
      description: "查询城市天气",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "城市名" } },
        required: ["city"],
      },
      endpoint: "https://api.example.com/weather",
      method: "GET",
    });
    expect(data.name).toBe("天气查询");
    expect(data.method).toBe("GET");
    expect(data.parameters.required).toEqual(["city"]);
    expect(data.parameters.properties.city.description).toBe("城市名");
  });

  it("endpoint 非 URL 时失败", () => {
    expect(() =>
      createToolSchema.parse({
        name: "x",
        parameters: { type: "object", properties: {} },
        endpoint: "not-a-url",
      })
    ).toThrow();
  });

  it("method 只允许 GET/POST", () => {
    expect(() =>
      createToolSchema.parse({
        name: "x",
        parameters: { type: "object", properties: {} },
        endpoint: "https://api.example.com",
        method: "DELETE",
      })
    ).toThrow();
  });
});

describe("toolParametersSchema", () => {
  it("properties 类型只允许 string/number/boolean", () => {
    expect(() =>
      toolParametersSchema.parse({
        type: "object",
        properties: { foo: { type: "array" } },
      })
    ).toThrow();
  });

  it("required 默认为空数组", () => {
    const data = toolParametersSchema.parse({ type: "object", properties: {} });
    expect(data.required).toEqual([]);
  });
});
