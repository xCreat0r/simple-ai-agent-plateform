import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "@/routes/_middleware";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));

import { getDb } from "@/lib/db";
import { agentsRoutes } from "@/routes/agents";
import { toolsRoutes } from "@/routes/tools";

const mockedGetDb = vi.mocked(getDb);

// mock count 查询 + 插入
function mockDb(count: number) {
  const where = vi.fn().mockResolvedValue([{ count }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  mockedGetDb.mockReturnValue({ select, insert } as never);
}

// 挂载路由并注入 userId，模拟已登录用户
function withUser(routes: Hono<Env>): Hono<Env> {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("userId", "user-A");
    await next();
  });
  app.route("/", routes);
  return app;
}

const json = { "Content-Type": "application/json" };
const agentBody = { name: "agent-a", tools: [], knowledgeBaseIds: [] };
const toolBody = {
  name: "tool-a",
  endpoint: "https://api.example.com/v1",
  method: "POST",
  parameters: { type: "object", properties: {}, required: [] },
};

describe("Agent 创建数量配额", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("达到 maxAgents 上限时返回 429", async () => {
    mockDb(20);
    const res = await withUser(agentsRoutes).request("/", {
      method: "POST",
      headers: json,
      body: JSON.stringify(agentBody),
    });
    expect(res.status).toBe(429);
    const rj = (await res.json()) as { error?: string };
    expect(rj.error).toContain("创建上限");
  });

  it("未达上限时正常创建", async () => {
    mockDb(0);
    const res = await withUser(agentsRoutes).request("/", {
      method: "POST",
      headers: json,
      body: JSON.stringify(agentBody),
    });
    expect(res.status).toBe(201);
  });
});

describe("Tool 创建数量配额", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("达到 maxTools 上限时返回 429", async () => {
    mockDb(10);
    const res = await withUser(toolsRoutes).request("/", {
      method: "POST",
      headers: json,
      body: JSON.stringify(toolBody),
    });
    expect(res.status).toBe(429);
    const rj = (await res.json()) as { error?: string };
    expect(rj.error).toContain("创建上限");
  });

  it("未达上限时正常创建", async () => {
    mockDb(0);
    const res = await withUser(toolsRoutes).request("/", {
      method: "POST",
      headers: json,
      body: JSON.stringify(toolBody),
    });
    expect(res.status).toBe(201);
  });
});
