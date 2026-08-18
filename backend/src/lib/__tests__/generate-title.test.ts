import { describe, it, expect, vi, beforeEach } from "vitest";
import { chats } from "@/lib/db/schema";

// 静态 mock：getDb 与 openai 在 generate-title 加载前替换
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
  getModelForAgent: vi.fn(),
}));
// 记录查询排序方向：标题应基于最新一条 assistant 回复
const mockDesc = vi.fn((col: unknown) => col);
const mockAsc = vi.fn((col: unknown) => col);
vi.mock("drizzle-orm", () => ({
  desc: (...args: unknown[]) => mockDesc(...args),
  asc: (...args: unknown[]) => mockAsc(...args),
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));

import { generateChatTitle } from "@/lib/chat/generate-title";
import { getDb } from "@/lib/db";
import { openai } from "@/lib/ai/provider";

const mockedGetDb = vi.mocked(getDb);
const createMock = vi.mocked(openai.chat.completions.create);

// 构造 getDb().select().from(chats).where() 返回指定数据
function mockChatQuery(rows: unknown[]): void {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn().mockReturnValue({ from });
  mockedGetDb.mockReturnValue({ select } as never);
}

describe("generateChatTitle 让位逻辑", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("titleEdited=true 时直接返回，不调用 LLM 生成标题", async () => {
    mockChatQuery([{ titleEdited: true }]);
    await generateChatTitle("c1", "deepseek-chat", "用户问题");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("titleEdited=false 时继续走 LLM 生成流程", async () => {
    // chat 查询返回未编辑；messages 查询返回 assistant 回复（带 orderBy/limit 链）
    const from = vi.fn((t: unknown) => {
      if (t === chats) {
        return { where: vi.fn().mockResolvedValue([{ titleEdited: false }]) };
      }
      return {
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ content: "这是 AI 回复" }]),
          })),
        })),
      };
    });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as never);
    createMock.mockResolvedValue({
      choices: [{ message: { content: "测试标题" } }],
    } as never);

    await generateChatTitle("c1", "deepseek-chat", "用户问题");
    expect(createMock).toHaveBeenCalledTimes(1);
    // 素材应取最新一条 assistant 回复（desc），而非最早（asc）
    expect(mockDesc).toHaveBeenCalled();
    expect(mockAsc).not.toHaveBeenCalled();
  });
});
