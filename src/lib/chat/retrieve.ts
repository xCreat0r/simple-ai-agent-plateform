import "server-only";
import type OpenAI from "openai";
import { db } from "@/lib/db";
import { agentKnowledge } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { retrieveContext } from "@/lib/ai/retriever";
import { deduplicateChunks } from "@/lib/util/text";

export async function injectKnowledgeContext(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  agentId: string,
  userQuery: string,
  topK = 3
): Promise<void> {
  const linkedKbs = await db
    .select({ kbId: agentKnowledge.kbId })
    .from(agentKnowledge)
    .where(eq(agentKnowledge.agentId, agentId));

  if (linkedKbs.length === 0) return;

  const allChunks: string[] = [];
  for (const { kbId } of linkedKbs) {
    const chunks = await retrieveContext(kbId, userQuery, topK);
    allChunks.push(...chunks);
  }

  if (allChunks.length === 0) return;

  const contextBlock = "参考以下知识来回答用户问题：\n\n" + deduplicateChunks(allChunks).join("\n---\n");
  if (messages[0]?.role === "system") {
    messages[0].content = messages[0].content + "\n\n" + contextBlock;
  } else {
    messages.unshift({ role: "system", content: contextBlock });
  }
}
