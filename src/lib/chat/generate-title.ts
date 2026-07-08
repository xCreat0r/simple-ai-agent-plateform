import "server-only";
import { db } from "@/lib/db";
import { asc, and, eq } from "drizzle-orm";
import { chats, messages } from "@/lib/db/schema";
import { openai } from "@/lib/ai/provider";

export async function generateChatTitle(
  chatId: string,
  agentId: string,
  model: string,
  userQuery: string,
): Promise<void> {
  try {
    const [assistantMsg] = await db
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.role, "assistant")))
      .orderBy(asc(messages.createdAt))
      .limit(1);

    if (!assistantMsg?.content) return;

    const titleRes = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "根据对话内容生成一个10字以内的简短中文标题，只返回标题文本。" },
        { role: "user", content: `用户：${userQuery}\nAI：${assistantMsg.content.slice(0, 300)}` },
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    const title = titleRes.choices[0]?.message?.content?.trim()?.replace(/[""「」『』]/g, "");
    if (title) {
      await db.update(chats).set({ title }).where(eq(chats.id, chatId));
    }
  } catch (e) {
    console.warn("生成标题失败", e);
  }
}
