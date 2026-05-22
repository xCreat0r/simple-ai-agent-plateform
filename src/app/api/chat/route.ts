import OpenAI from "openai";
import { db } from "@/lib/db";
import { agents, agentTools, chats, messages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getTool } from "@/lib/tools";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
});

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, chatId: existingChatId, content } = body;

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

  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (agent.systemPrompt) {
    conversationMessages.push({
      role: "system",
      content: agent.systemPrompt,
    });
  }

  for (const m of history.slice(-20)) {
    if (m.role === "user") {
      conversationMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const entry: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: "assistant",
        content: m.content || "",
      };
      if (m.toolCalls) {
        entry.tool_calls = (m.toolCalls as Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>);
      }
      conversationMessages.push(entry);
    } else if (m.role === "tool") {
      conversationMessages.push({
        role: "tool",
        content: m.content,
        tool_call_id: (m.toolResult as Record<string, string>)?.toolCallId ?? "",
      });
    }
  }

  const toolDefs = enabledToolIds
    .map((id) => getTool(id))
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
    async start(controller) {
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
            const tool = getTool(tc.name);
            if (!tool) continue;

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {}

            controller.enqueue(
              encoder.encode(`\n[Tool: ${tc.name}]\n`)
            );

            const toolResult = await tool.execute(args);

            controller.enqueue(
              encoder.encode(`[Result: ${toolResult.slice(0, 200)}]\n`)
            );

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
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-chat-id": chatId,
    },
  });
}
