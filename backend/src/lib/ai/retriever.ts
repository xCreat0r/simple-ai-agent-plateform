import { getDb } from "@/lib/db";
import { knowledgeChunks, knowledgeDocuments } from "@/lib/db/schema";
import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { generateEmbedding } from "./embedding";
import { logger } from "@/lib/logger";

export interface RetrievedChunk {
  docId: string;
  content: string;
  filename: string;
}

export async function retrieveContext(
  kbIds: string[],
  query: string,
  topK = 3,
  threshold = 0.25
): Promise<RetrievedChunk[]> {
  if (kbIds.length === 0) return [];

  const startedAt = Date.now();
  // 1. 将用户问题编码为向量
  const embedding = await generateEmbedding(query);
  const db = getDb();

  // 2. 与知识库分块做余弦相似度排序，distance <= threshold 才视为相关
  const distance = cosineDistance(knowledgeChunks.embedding, embedding);

  const rows = await db
    .select({
      docId: knowledgeChunks.docId,
      content: knowledgeChunks.content,
      filename: knowledgeDocuments.filename,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.docId, knowledgeDocuments.id))
    .where(
      and(
        inArray(knowledgeChunks.kbId, kbIds),
        isNotNull(knowledgeChunks.embedding),
        sql`${distance} <= ${threshold}`
      )
    )
    .orderBy(distance)
    .limit(topK);

  logger.metric("knowledge.retrieve", {
    kbCount: kbIds.length,
    topK,
    threshold,
    hits: rows.length,
    elapsedMs: Date.now() - startedAt,
  });

  return rows.map((r) => ({ docId: r.docId, content: r.content, filename: r.filename }));
}
