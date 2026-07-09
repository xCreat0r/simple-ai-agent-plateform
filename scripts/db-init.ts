import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("初始化数据库扩展...");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
  console.log("pgvector 扩展已就绪");
  process.exit(0);
}

main();
