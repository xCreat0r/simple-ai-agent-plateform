import type OpenAI from "openai";
import { openai } from "@/lib/ai/provider";
import { getDb } from "@/lib/db";
import { messages as messagesTable } from "@/lib/db/schema";
import { getTool } from "@/lib/tools/db-tools";
import { generateId } from "@/lib/util/uuid";
import { wrapUntrusted } from "./untrusted";

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

  // 核心 Agent 循环：模型每次可返回内容+工具调用。
  // 若返回工具调用则执行工具并把结果追加回消息，继续下一轮；
  // 直到模型不再调用工具或达到最大步数。
  for (let step = 0; step < maxSteps; step++) {
    const completion = await openai.chat.completions.create({
      model,
      messages: currentMessages,
      temperature,
      max_completion_tokens: maxTokens,
      tools: toolDefs.length > 0 ? toolDefs as OpenAI.Chat.Completions.ChatCompletionTool[] : undefined,
      stream: true,
    });

    // 流式返回可能把一次工具调用拆成多个 chunk，
    // 用 index 归并同一次调用的参数片段
    let toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
    let stepContent = "";

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta;

      // 普通文本增量：边生成边推给前端（打字机效果）
      if (delta?.content) {
        stepContent += delta.content;
        controller.enqueue(encoder.encode(delta.content));
      }

      // 工具调用增量：按 index 聚合，直到流结束再解析完整参数
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
      // 模型请求调用工具：先把 assistant 消息（含 tool_calls）落库，
      // 供后续上下文重建与历史展示
      const toolCallsForDb = toolCallsArray.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));

      const now = new Date();

      await getDb().insert(messagesTable).values({
        id: generateId(),
        chatId,
        role: "assistant",
        content: stepContent || "",
        toolCalls: toolCallsForDb,
        createdAt: now,
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

      // 依次执行每个工具调用，把结果以 tool 角色消息写回上下文
      for (const tc of toolCallsArray) {
        const tool = await getTool(tc.name);

        controller.enqueue(encoder.encode(`\n\n> 🔍 正在调用 ${tc.name}...\n\n`));

        let toolResult: string;
        if (!tool) {
          toolResult = `工具 "${tc.name}" 未找到`;
        } else {
          // 工具参数在流式中是拼接好的 JSON 字符串，解析失败则视为无参数
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments);
          } catch {}

          try {
            toolResult = await tool.execute(args);
          } catch (err) {
            // 工具执行异常隔离：转成 tool 消息返回模型，让其纠错继续，不中断整场对话
            toolResult = `工具执行失败: ${err instanceof Error ? err.message : "未知错误"}`;
          }
        }

        controller.enqueue(encoder.encode(`> ✅ ${tc.name} 完成\n\n`));

        await getDb().insert(messagesTable).values({
          id: generateId(),
          chatId,
          role: "tool",
          content: toolResult,
          toolResult: { toolCallId: tc.id, content: toolResult },
          createdAt: new Date(),
        });

        // 落库存原始内容，仅传给模型时包裹不可信标签，前端历史展示保持干净
        currentMessages.push({
          role: "tool",
          content: wrapUntrusted(toolResult),
          tool_call_id: tc.id,
        });
      }
    } else {
      // 模型本轮未调用工具：普通回答，落库后结束循环
      if (stepContent) {
        await getDb().insert(messagesTable).values({
          id: generateId(),
          chatId,
          role: "assistant",
          content: stepContent,
          createdAt: new Date(),
        });
      }
      break;
    }
  }
}
