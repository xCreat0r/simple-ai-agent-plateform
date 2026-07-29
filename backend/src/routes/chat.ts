import { Hono } from "hono";
import type { Env } from "./_middleware";
import { stream } from "hono/streaming";
import { getDb } from "@/lib/db";
import { agents, agentTools, chats, messages } from "@/lib/db/schema";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getTool } from "@/lib/tools/db-tools";
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
  const { agentId, chatId: existingChatId, content, regenerate } = await c.req.json() as {
    agentId: string; chatId?: string; content?: string; regenerate?: boolean;
  };

  if (!regenerate && (!content || typeof content !== "string" || content.length > config.chat.maxContentLength)) {
    return c.json({ error: "消息内容无效" }, 400);
  }

  const rateLimit = await checkRateLimit(
    `chat:${userId}`, config.rateLimit.maxRequestsPerWindow, config.rateLimit.windowMs
  );
  if (!rateLimit.allowed) return c.json({ error: "请求过于频繁" }, 429);

  const db = getDb();
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  const quota = await checkQuota(agent.userId);
  if (!quota.allowed) return c.json({ error: quota.reason || "配额已用完" }, 429);

  const toolRows = await db.select().from(agentTools).where(eq(agentTools.agentId, agentId));
  const enabledToolIds = toolRows.map((r) => r.toolId);

  let chatId = existingChatId;
  const isNewChat = !chatId;
  if (!chatId) {
    chatId = generateId();
    await db.insert(chats).values({
      id: chatId, agentId, title: content?.slice(0, 50) || "新对话", createdAt: new Date(),
    });
  }

  if (regenerate) {
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

  const conversationMessages = await buildConversationMessages(chatId, agent.systemPrompt);
  const userQuery = (regenerate
    ? (conversationMessages.filter((m) => m.role === "user").at(-1) as { content: string } | undefined)?.content
    : content) || "";

  await injectKnowledgeContext(conversationMessages, agentId, userQuery);

  const enabledTools = await Promise.all(enabledToolIds.map((id) => getTool(id)));
  const toolDefs = enabledTools.filter(Boolean).map((t) => ({
    type: "function" as const,
    function: { name: t!.id, description: t!.description, parameters: t!.parameters },
  }));

  return stream(c, async (stream) => {
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      start(controller) {
        runToolLoop(controller, conversationMessages, toolDefs, {
          chatId, model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens,
        }).then(async () => {
          controller.close();
          if (isNewChat) await generateChatTitle(chatId, agent.id, agent.model, userQuery);
        }).catch((err) => {
          controller.enqueue(encoder.encode(`\n\n错误: ${err.message}\n\n`));
          controller.error(err);
        });
      },
    });

    const reader = sseStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await stream.write(value);
    }
  });
});

export { chatRoutes };
