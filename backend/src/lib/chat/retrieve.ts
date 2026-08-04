import type OpenAI from "openai";
import { getDb } from "@/lib/db";
import { agentKnowledge } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { retrieveContext } from "@/lib/ai/retriever";
import { deduplicateChunks } from "@/lib/util/text";
import { config } from "@/lib/config";

export async function injectKnowledgeContext(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  agentId: string,
  userQuery: string,
  topK = config.knowledge.topK
): Promise<void> {
  // 查询该 agent 关联的知识库
  const linkedKbs = await getDb()
    .select({ kbId: agentKnowledge.kbId })
    .from(agentKnowledge)
    .where(eq(agentKnowledge.agentId, agentId));

  if (linkedKbs.length === 0) return;

  const kbIds = linkedKbs.map((r) => r.kbId);
  // 向量检索：用用户问题嵌入与知识库分块做余弦相似度匹配
  const chunks = await retrieveContext(kbIds, userQuery, topK, config.knowledge.similarityThreshold);

  if (chunks.length === 0) return;

  // 将检索到的知识块拼成 system 提示注入，要求模型引用来源文件名
  const contextBlock =
    "参考以下知识来回答用户问题，并在引用时注明来源文件名：\n\n" +
    deduplicateChunks(chunks.map((c) => `[来源: ${c.filename}]\n${c.content}`))
      .join("\n---\n");

  if (messages[0]?.role === "system") {
    messages[0].content = messages[0].content + "\n\n" + contextBlock;
  } else {
    messages.unshift({ role: "system", content: contextBlock });
  }
}
