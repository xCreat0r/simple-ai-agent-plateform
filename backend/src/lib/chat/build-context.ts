import type OpenAI from "openai";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { toolCallSchema, toolResultSchema } from "@/lib/validators";
import { UNTRUSTED_DECLARATION, wrapUntrusted } from "./untrusted";

export async function buildConversationMessages(
  chatId: string,
  systemPrompt: string | null
): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
  // 只取最近 20 条消息作为上下文窗口，控制 token 成本
  const recentHistory = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(20);

  // 数据库按时间倒序查询，需要反转回正序
  const history = recentHistory.reverse();
  const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  const toolCallIdSet = new Set<string>();

  // 将 DB 记录转换为 OpenAI Chat API 所需的消息格式。
  // assistant 消息要还原 tool_calls，tool 消息要带 tool_call_id 关联。
  for (const m of history) {
    if (m.role === "user") {
      historyMessages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const toolCallsData = typeof m.toolCalls === "string" ? JSON.parse(m.toolCalls) : m.toolCalls;
      const parsed = toolCallSchema.array().nullable().safeParse(toolCallsData);
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
      const toolResultData = typeof m.toolResult === "string" ? JSON.parse(m.toolResult) : m.toolResult;
      const parsed = toolResultSchema.safeParse(toolResultData);
      const tid = parsed.success ? parsed.data.toolCallId : "";
      // 工具返回值可能含恶意指令，用不可信标签包裹后再传给 LLM
      historyMessages.push({ role: "tool", content: wrapUntrusted(m.content), tool_call_id: tid });
    }
  }

  // 检测工具调用序列是否完整：assistant 声明了 tool_calls 就必须有对应 tool 结果，
  // 否则序列断裂会导致 API 报错，需要丢弃该段历史重新开始
  const hasIncompleteSequence = detectIncompleteToolSequence(historyMessages);

  let conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];

  if (hasIncompleteSequence) {
    console.warn("Skipping malformed tool call history, starting fresh");
    conversationMessages = historyMessages.filter((m) => m.role === "user");
  } else {
    conversationMessages = historyMessages;
  }

  const styleGuide = "\n\n回复风格：用自然对话语气。可以使用代码块、列表、加粗、表格组织内容，但不要使用 emoji。";

  // 系统提示词置顶：优先使用 agent 自定义提示词，否则用默认助手提示词，
  // 末尾始终附加防注入安全规则（含不可信数据标签语义）
  if (systemPrompt) {
    conversationMessages.unshift({
      role: "system",
      content: systemPrompt + styleGuide + UNTRUSTED_DECLARATION,
    });
  } else {
    conversationMessages.unshift({
      role: "system",
      content: "你是一个友好的 AI 助手。" + styleGuide + UNTRUSTED_DECLARATION,
    });
  }

  return conversationMessages;
}

// 遍历消息序列：若某个 assistant 消息声明了 tool_calls，
// 但其后紧跟的 tool 消息并未覆盖所有声明的 call id，则判定序列不完整
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
