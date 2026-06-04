import OpenAI from "openai";
import { db } from "@/lib/db";
import { agents, agentTools, chats, messages, agentKnowledge } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getTool } from "@/lib/tools/db-tools";
import { retrieveContext } from "@/lib/ai/retriever";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
});

const rateLimitMap = new Map<string, number>();

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, chatId: existingChatId, content } = body;

  if (!content || typeof content !== "string") {
    return Response.json({ error: "消息内容不能为空" }, { status: 400 });
  }
  if (content.length > 4000) {
    return Response.json({ error: "消息过长，请限制在 4000 字符内" }, { status: 400 });
  }

  const now = Date.now();
  const lastRequest = rateLimitMap.get(agentId);
  if (lastRequest && now - lastRequest < 1000) {
    return Response.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  rateLimitMap.set(agentId, now);

  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
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

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));

  let conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  const recentHistory = history.slice(-20);
  const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  const toolCallIdSet = new Set<string>();

  for (const m of recentHistory) {
    if (m.role === "user") {
      historyMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const toolCalls = m.toolCalls as Array<{
        id: string; type: "function"; function: { name: string; arguments: string };
      }> | null;
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) toolCallIdSet.add(tc.id);
        historyMessages.push({
          role: "assistant",
          content: m.content || "",
          tool_calls: toolCalls,
        });
      } else {
        historyMessages.push({ role: "assistant", content: m.content || "" });
      }
    } else if (m.role === "tool") {
      const tid = (m.toolResult as Record<string, string>)?.toolCallId ?? "";
      historyMessages.push({ role: "tool", content: m.content, tool_call_id: tid });
    }
  }

  let hasIncompleteSequence = false;
  for (let i = 0; i < historyMessages.length; i++) {
    const msg = historyMessages[i] as unknown as Record<string, unknown>;
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      const callIds = new Set((msg.tool_calls as Array<{ id: string }>).map((t) => t.id));
      const matched = new Set<string>();
      for (let j = i + 1; j < historyMessages.length; j++) {
        const next = historyMessages[j] as unknown as Record<string, unknown>;
        if (next.role === "tool" && callIds.has(next.tool_call_id as string)) {
          matched.add(next.tool_call_id as string);
        } else if (next.role !== "tool") {
          break;
        }
      }
      if (matched.size !== callIds.size) {
        hasIncompleteSequence = true;
        break;
      }
    }
  }

  if (hasIncompleteSequence) {
    console.warn("Skipping malformed tool call history, starting fresh");
    for (const m of historyMessages) {
      if (m.role === "user") {
        conversationMessages.push(m);
      }
    }
  } else {
    conversationMessages = historyMessages;
  }

  const styleGuide = "\n\n回复风格：用自然对话语气，不使用 markdown 表格、emoji、列表等结构化格式，像朋友聊天一样说话。";

  if (agent.systemPrompt) {
    conversationMessages.unshift({
      role: "system",
      content: agent.systemPrompt + styleGuide,
    });
  } else {
    conversationMessages.unshift({
      role: "system",
      content: "你是一个友好的 AI 助手。" + styleGuide,
    });
  }

  const linkedKbs = await db
    .select({ kbId: agentKnowledge.kbId })
    .from(agentKnowledge)
    .where(eq(agentKnowledge.agentId, agentId));

  if (linkedKbs.length > 0) {
    const allChunks: string[] = [];
    const userQuery = content;
    for (const { kbId } of linkedKbs) {
      const chunks = await retrieveContext(kbId, userQuery, 2);
      allChunks.push(...chunks);
    }
    if (allChunks.length > 0) {
      const contextBlock = "参考以下知识来回答用户问题：\n\n" + allChunks.join("\n---\n");
      if (conversationMessages[0]?.role === "system") {
        conversationMessages[0].content = conversationMessages[0].content + "\n\n" + contextBlock;
      } else {
        conversationMessages.unshift({ role: "system", content: contextBlock });
      }
    }
  }

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      runStream(controller);
    },
  });

  async function runStream(controller: ReadableStreamDefaultController) {
    try {
      let currentMessages = [...conversationMessages];
      let fullContent = "";
      const maxSteps = 5;

      for (let step = 0; step < maxSteps; step++) {
        const completion = await client.chat.completions.create({
          model: agent.model,
          messages: currentMessages,
          temperature: parseFloat(agent.temperature),
          max_tokens: agent.maxTokens,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          stream: true,
        });

        let toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
        let stepContent = "";

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            stepContent += delta.content;
            fullContent += delta.content;
            controller.enqueue(encoder.encode(delta.content));
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  arguments: "",
                });
              }
              if (tc.function?.arguments) {
                const existing = toolCallsMap.get(idx)!;
                existing.arguments += tc.function.arguments;
              }
            }
          }
        }

        const toolCallsArray = Array.from(toolCallsMap.values()).sort(
          (a, b) => toolCallsMap.size - Array.from(toolCallsMap.keys()).indexOf(0)
        );

        if (toolCallsArray.length > 0) {
          const toolCallsForDb = toolCallsArray.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          }));

          await db.insert(messages).values({
            chatId,
            role: "assistant",
            content: stepContent || "",
            toolCalls: toolCallsForDb,
          });

          currentMessages.push({
            role: "assistant",
            content: stepContent || null,
            tool_calls: toolCallsArray.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          });

          for (const tc of toolCallsArray) {
            const tool = await getTool(tc.name);

            let toolResult: string;
            if (!tool) {
              toolResult = `工具 "${tc.name}" 未找到`;
            } else {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(tc.arguments);
              } catch {}

              toolResult = await tool.execute(args);
            }

            await db.insert(messages).values({
              chatId,
              role: "tool",
              content: toolResult,
              toolResult: { toolCallId: tc.id, content: toolResult },
            });

            currentMessages.push({
              role: "tool",
              content: toolResult,
              tool_call_id: tc.id,
            });
          }
        } else {
          if (fullContent) {
            await db.insert(messages).values({
              chatId,
              role: "assistant",
              content: fullContent,
            });
          }
          break;
        }
      }

      controller.close();
    } catch (err) {
      controller.error(err);
    }
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-chat-id": chatId,
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
