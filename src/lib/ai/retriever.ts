import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generateEmbedding } from "./embedding";
import { knowledgeChunks } from "@/lib/db/schema";

export async function retrieveContext(
  kbId: string,
  query: string,
  topK = 3
): Promise<string[]> {
  const embedding = await generateEmbedding(query);
  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await db.execute(sql`
    SELECT content
    FROM knowledge_chunks
    WHERE kb_id = ${kbId}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `);

  return (rows as unknown as { content: string }[]).map((r) => r.content);
}
