import "server-only";
import type OpenAI from "openai";
import { db } from "@/lib/db";
import { agentKnowledge } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { retrieveContext } from "@/lib/ai/retriever";

function overlapRatio(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length === 0) return 0;
  const common = new Set(shorter.split(""));
  const intersection = [...longer].filter((ch) => common.has(ch)).length;
  return intersection / longer.length;
}

function deduplicateChunks(chunks: string[]): string[] {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (!result.some((r) => overlapRatio(r, chunk) > 0.7)) {
      result.push(chunk);
    }
  }
  return result;
}

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
