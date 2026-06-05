import { db } from "@/lib/db";
import { agents, agentTools, chats, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTool } from "@/lib/tools/db-tools";
import { badRequest, notFound, tooManyRequests } from "@/lib/errors";
import { buildConversationMessages } from "@/lib/chat/build-context";
import { injectKnowledgeContext } from "@/lib/chat/retrieve";
import { runToolLoop } from "@/lib/chat/tool-loop";

const rateLimitMap = new Map<string, number>();

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, chatId: existingChatId, content } = body;

  if (!content || typeof content !== "string") {
    return badRequest("消息内容不能为空");
  }
  if (content.length > 4000) {
    return badRequest("消息过长，请限制在 4000 字符内");
  }

  const now = Date.now();
  const lastRequest = rateLimitMap.get(agentId);
  if (lastRequest && now - lastRequest < 1000) {
    return tooManyRequests("请求过于频繁，请稍后再试");
  }
  rateLimitMap.set(agentId, now);

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) {
    return notFound("Agent not found");
  }

  const toolRows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId));
  const enabledToolIds = toolRows.map((r) => r.toolId);

  let chatId = existingChatId;
  if (!chatId) {
    const [chat] = await db
      .insert(chats)
      .values({ agentId, title: content.slice(0, 50) || "新对话" })
      .returning();
    chatId = chat.id;
  }

  await db.insert(messages).values({
    chatId,
    role: "user",
    content,
  });

  const conversationMessages = await buildConversationMessages(
    chatId,
    agent.systemPrompt
  );

  await injectKnowledgeContext(conversationMessages, agentId, content);

  const enabledTools = await Promise.all(enabledToolIds.map((id) => getTool(id)));
  const toolDefs = enabledTools
    .filter(Boolean)
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t!.id,
        description: t!.description,
        parameters: t!.parameters,
      },
    }));

  const stream = new ReadableStream({
    start(controller) {
      runToolLoop(controller, conversationMessages, toolDefs, {
        chatId,
        model: agent.model,
        temperature: parseFloat(agent.temperature),
        maxTokens: agent.maxTokens,
      }).then(() => controller.close()).catch((err) => controller.error(err));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-chat-id": chatId,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
