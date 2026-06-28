import "server-only";
import type OpenAI from "openai";
import { openai } from "@/lib/ai/provider";
import { db } from "@/lib/db";
import { messages as messagesTable } from "@/lib/db/schema";
import { getTool } from "@/lib/tools/db-tools";

interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

interface ToolLoopOptions {
  chatId: string;
  model: string;
  temperature: number;
  maxTokens: number;
}
const encoder = new TextEncoder();

export async function runToolLoop(
  controller: ReadableStreamDefaultController,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  toolDefs: ToolDef[],
  options: ToolLoopOptions
): Promise<void> {
  const { chatId, model, temperature, maxTokens } = options;
  let currentMessages = [...messages];
  const maxSteps = 5;

  for (let step = 0; step < maxSteps; step++) {
    const completion = await openai.chat.completions.create({
      model,
      messages: currentMessages,
      temperature,
      max_tokens: maxTokens,
      tools: toolDefs.length > 0 ? toolDefs as OpenAI.Chat.Completions.ChatCompletionTool[] : undefined,
      stream: true,
    });

    let toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
    let stepContent = "";

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        stepContent += delta.content;
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

    const toolCallsArray = Array.from(toolCallsMap.values());

    if (toolCallsArray.length > 0) {
      const toolCallsForDb = toolCallsArray.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));

      await db.insert(messagesTable).values({
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

        controller.enqueue(encoder.encode(`\n\n> 🔍 正在调用 ${tc.name}...\n\n`));

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

        controller.enqueue(encoder.encode(`> ✅ ${tc.name} 完成\n\n`));

        await db.insert(messagesTable).values({
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
      if (stepContent) {
        await db.insert(messagesTable).values({
          chatId,
          role: "assistant",
          content: stepContent,
        });
      }
      break;
    }
  }
}
