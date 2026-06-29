import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
      ON knowledge_chunks
      USING hnsw (embedding vector_cosine_ops);
    `);
    console.log("HNSW 索引已创建");
  } catch (err: any) {
    if (err?.message?.includes("already exists")) {
      console.log("索引已存在，跳过创建");
    } else {
      console.error("创建索引失败:", err?.message || err);
      process.exit(1);
    }
  }

  process.exit(0);
}

main();
