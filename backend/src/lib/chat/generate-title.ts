import { getDb } from "@/lib/db";
import { desc, and, eq } from "drizzle-orm";
import { chats, messages } from "@/lib/db/schema";
import { openai } from "@/lib/ai/provider";

export async function generateChatTitle(
  chatId: string,
  model: string,
  userQuery: string,
): Promise<void> {
  try {
    // 用户手动改过名则不自动覆盖
    const [chat] = await getDb()
      .select({ titleEdited: chats.titleEdited })
      .from(chats)
      .where(eq(chats.id, chatId));
    if (chat?.titleEdited) return;

    // 取该对话最新一条 assistant 回复作为标题生成的素材
    // （最终回答最有代表性；工具调用消息可能 content 为空，不可取）
    const [assistantMsg] = await getDb()
    .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.role, "assistant")))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (!assistantMsg?.content) return;

    // 用 LLM 生成 10 字以内简短中文标题
    const titleRes = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "根据对话内容生成一个10字以内的简短中文标题，只返回标题文本。" },
        { role: "user", content: `用户：${userQuery}\nAI：${assistantMsg.content.slice(0, 300)}` },
      ],
      max_completion_tokens: 20,
      temperature: 0.3,
    });

    // 清理标题中的引号类字符后回写数据库
    const title = titleRes.choices[0]?.message?.content?.trim()?.replace(/[""「」『』]/g, "");
    if (title) {
      await getDb().update(chats).set({ title }).where(eq(chats.id, chatId));
    }
  } catch (e) {
    // 标题生成失败不影响主对话流程，仅记录警告
    console.warn("生成标题失败", e);
  }
}
