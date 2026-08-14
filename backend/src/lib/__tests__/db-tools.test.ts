import { describe, it, expect, vi, beforeEach } from "vitest";

// mock DB，避免真实连接
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "@/lib/db";
import { getTool, getToolDefinitions } from "@/lib/tools/db-tools";

const mockedGetDb = vi.mocked(getDb);

// 构造 drizzle 查询链 mock：getDb().select().from(t).where(...) => rows
function mockSelectRows(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  mockedGetDb.mockReturnValue({ select } as never);
  return { select, from, where };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTool 所有权校验", () => {
  it("内置工具不受 userId 限制", async () => {
    const tool = await getTool("web_search", "any-user");
    expect(tool).toBeDefined();
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it("自定义工具未带 userId 时拒绝解析（不查库）", async () => {
    const { select } = mockSelectRows([]);
    const tool = await getTool("custom-tool-id");
    expect(tool).toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it("自定义工具不属于该 userId 时解析为 undefined", async () => {
    // 用户 B 查询用户 A 的工具：查库时按 userId 过滤，无匹配行
    const { where } = mockSelectRows([]);
    const tool = await getTool("custom-tool-id", "user-B");
    expect(tool).toBeUndefined();
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("自定义工具属于该 userId 时正常解析", async () => {
    mockSelectRows([{
      id: "custom-tool-id", userId: "user-A",
      parameters: { type: "object", properties: {}, required: [] },
    }]);
    const tool = await getTool("custom-tool-id", "user-A");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("custom-tool-id");
  });
});

describe("getToolDefinitions 归属过滤", () => {
  it("自定义工具带 userId 时只返回匹配行", async () => {
    const { where } = mockSelectRows([{
      id: "t1", userId: "user-A",
      parameters: { type: "object", properties: {}, required: [] },
    }]);
    const defs = await getToolDefinitions(["t1"], "user-A");
    expect(defs).toHaveLength(1);
    expect(defs[0].id).toBe("t1");
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("自定义工具未带 userId 时跳过", async () => {
    const { select } = mockSelectRows([]);
    const defs = await getToolDefinitions(["t1"]);
    expect(defs).toHaveLength(0);
    expect(select).not.toHaveBeenCalled();
  });

  it("内置工具始终返回", async () => {
    const defs = await getToolDefinitions(["web_request"], "user-A");
    expect(defs.map((d) => d.id)).toContain("web_request");
    expect(mockedGetDb).not.toHaveBeenCalled();
  });
});
