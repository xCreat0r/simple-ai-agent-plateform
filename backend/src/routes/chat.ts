import { Hono } from "hono";
import type { Env } from "./_middleware";
import { stream } from "hono/streaming";
import { getDb } from "@/lib/db";
import { agents, agentTools, chats, messages } from "@/lib/db/schema";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { getToolDefinitions } from "@/lib/tools/db-tools";
import { buildConversationMessages } from "@/lib/chat/build-context";
import { injectKnowledgeContext } from "@/lib/chat/retrieve";
import { runToolLoop } from "@/lib/chat/tool-loop";
import { checkQuota } from "@/lib/quota";
import { generateChatTitle } from "@/lib/chat/generate-title";
import { checkRateLimit } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { generateId } from "@/lib/util/uuid";


const chatRoutes = new Hono<Env>();

chatRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  // regenerate: 重新生成最后一条用户消息的回复（删除其后所有 assistant/tool 消息）
  const { agentId, chatId: existingChatId, content, regenerate } = await c.req.json() as {
    agentId: string; chatId?: string; content?: string; regenerate?: boolean;
  };

  // 非 regenerate 模式下 content 必填且不能超长
  if (!regenerate && (!content || typeof content !== "string" || content.length > config.chat.maxContentLength)) {
    return c.json({ error: "消息内容无效" }, 400);
  }

  // 基于 KV 的固定窗口限流，按用户维度限制请求频率
  const rateLimit = await checkRateLimit(
    `chat:${userId}`, config.rateLimit.maxRequestsPerWindow, config.rateLimit.windowMs
  );
  if (!rateLimit.allowed) return c.json({ error: "请求过于频繁" }, 429);

  // 校验 agent 归属：只能使用属于当前用户的 agent
  const db = getDb();
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  // 每日请求配额校验（当前仅 free 套餐）
  const quota = await checkQuota(agent.userId);
  if (!quota.allowed) return c.json({ error: quota.reason || "配额已用完" }, 429);

  const toolRows = await db.select().from(agentTools).where(eq(agentTools.agentId, agentId));
  const enabledToolIds = toolRows.map((r) => r.toolId);

  let chatId = existingChatId;
  if (!chatId) {
    // 新对话：先创建 chat 记录，标题先用首条消息截断占位
    chatId = generateId();
    await db.insert(chats).values({
      id: chatId, agentId, title: content?.slice(0, 50) || "新对话", createdAt: new Date(),
    });
  } else {
    // 已有对话：校验该 chat 存在、属于当前用户且属于该 agent，
    // 避免往不存在的 chat 插入消息触发外键错误，或跨 agent 串用
    const [existing] = await db
      .select({ id: chats.id })
      .from(chats)
      .innerJoin(agents, eq(chats.agentId, agents.id))
      .where(and(eq(chats.id, chatId), eq(chats.agentId, agentId), eq(agents.userId, userId)))
      .limit(1);
    if (!existing) return c.json({ error: "对话不存在或无权访问" }, 404);
  }

  // 判断该对话是否首次对话（尚无任何消息），首轮回复完成后生成标题
  const [{ count: existingMsgCount }] = await db
    .select({ count: count() })
    .from(messages)
    .where(eq(messages.chatId, chatId));
  const isFirstConversation = existingMsgCount === 0;

  if (regenerate) {
    // 重新生成：找到最后一条用户消息，删除其后所有 assistant/tool 消息，
    // 使对话回退到"该用户消息刚发出"的状态
    const [lastUserMsg] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.role, "user")))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (lastUserMsg) {
      await db.delete(messages).where(
        and(eq(messages.chatId, chatId), inArray(messages.role, ["assistant", "tool"]), gt(messages.createdAt, lastUserMsg.createdAt))
      );
    }
  } else {
    await db.insert(messages).values({
      id: generateId(), chatId, role: "user", content: content!, createdAt: new Date(),
    });
  }

  // 组装传给 LLM 的对话历史（含系统提示、工具调用/结果序列）
  const conversationMessages = await buildConversationMessages(chatId, agent.systemPrompt);
  // regenerate 模式下 userQuery 从历史里取最后一条用户消息
  const userQuery = (regenerate
    ? (conversationMessages.filter((m) => m.role === "user").at(-1) as { content: string } | undefined)?.content
    : content) || "";

  // 将 agent 关联的知识库内容注入为 system 消息（RAG 检索增强）。
  // 检索或嵌入失败时不中断对话，回退为普通回答。
  try {
    await injectKnowledgeContext(conversationMessages, agentId, userQuery);
  } catch (err) {
    console.warn(`[chat] 知识检索失败，跳过知识注入: ${err instanceof Error ? err.message : "未知错误"}`);
  }

  // 收集该 agent 启用的工具定义，供 LLM 选择调用（批量查询，避免 N+1）；
  // 带 userId 校验归属，防止跨用户工具被带入
  const enabledToolDefs = await getToolDefinitions(enabledToolIds, userId);
  const toolDefs = enabledToolDefs.map((t) => ({
    type: "function" as const,
    function: { name: t.id, description: t.description, parameters: t.parameters },
  }));

  // 以 SSE 流式返回：ReadableStream 生产数据，runToolLoop 异步执行工具循环
  return stream(c, async (stream) => {
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      start(controller) {
        runToolLoop(controller, conversationMessages, toolDefs, {
          chatId, model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens, userId,
        }).then(async () => {
          controller.close();
          // 首次对话在首个回复完成后异步生成标题（失败不影响主流程）
          if (isFirstConversation) await generateChatTitle(chatId, agent.id, agent.model, userQuery);
        }).catch((err) => {
          // 错误以明确标记注入流，前端据此展示独立错误消息（不混入正文）。
          // 仅回显通用文案，真实错误进服务端日志，避免泄露内部细节
          console.error("[chat] 流式生成失败:", err);
          controller.enqueue(encoder.encode(`\n\n[error] 生成失败，请重试[/error]\n\n`));
          controller.error(err);
        });
      },
    });

    // 将内部流逐块转发给客户端
    const reader = sseStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await stream.write(value);
    }
  });
});

export { chatRoutes };
