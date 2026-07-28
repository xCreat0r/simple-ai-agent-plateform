import { getDb } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { generateEmbedding } from "./embedding";

export async function retrieveContext(
  kbId: string,
  query: string,
  topK = 3
): Promise<string[]> {
  const embedding = await generateEmbedding(query);
  const db = getDb();

  const rows = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.kbId, kbId),
        isNotNull(knowledgeChunks.embedding)
      )
    )
    .orderBy(cosineDistance(knowledgeChunks.embedding, embedding))
    .limit(topK);

  return rows.map((r) => r.content);
}
