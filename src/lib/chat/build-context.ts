import "server-only";
import type OpenAI from "openai";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { toolCallSchema, toolResultSchema } from "@/lib/validators";

export async function buildConversationMessages(
  chatId: string,
  systemPrompt: string | null
): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));

  const recentHistory = history.slice(-20);
  const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  const toolCallIdSet = new Set<string>();

  for (const m of recentHistory) {
    if (m.role === "user") {
      historyMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const parsed = toolCallSchema.array().nullable().safeParse(m.toolCalls);
      const toolCalls = parsed.success ? parsed.data : null;
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
      const parsed = toolResultSchema.safeParse(m.toolResult);
      const tid = parsed.success ? parsed.data.toolCallId : "";
      historyMessages.push({ role: "tool", content: m.content, tool_call_id: tid });
    }
  }

  const hasIncompleteSequence = detectIncompleteToolSequence(historyMessages);

  let conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  if (hasIncompleteSequence) {
    console.warn("Skipping malformed tool call history, starting fresh");
    conversationMessages = historyMessages.filter((m) => m.role === "user");
  } else {
    conversationMessages = historyMessages;
  }

  const styleGuide = "\n\n回复风格：用自然对话语气，不使用 markdown 表格、emoji、列表等结构化格式，像朋友聊天一样说话。";

  if (systemPrompt) {
    conversationMessages.unshift({
      role: "system",
      content: systemPrompt + styleGuide,
    });
  } else {
    conversationMessages.unshift({
      role: "system",
      content: "你是一个友好的 AI 助手。" + styleGuide,
    });
  }

  return conversationMessages;
}

function detectIncompleteToolSequence(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): boolean {
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      const callIds = new Set(msg.tool_calls.map((t) => t.id));
      const matched = new Set<string>();
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        if (next.role !== "tool") break;
        if (callIds.has(next.tool_call_id)) {
          matched.add(next.tool_call_id);
        }
      }
      if (matched.size !== callIds.size) return true;
    }
  }
  return false;
}
