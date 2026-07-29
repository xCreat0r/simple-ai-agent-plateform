import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function initDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
  try {
    await _db.execute(sql`SELECT 1`);
  } catch (err) {
    console.error("[DB] 连接失败:", (err as any).cause || err);
    throw err;
  }
}

export function getDb() {
  if (!_db) throw new Error("数据库未初始化，请先调用 initDb");
  return _db;
}
