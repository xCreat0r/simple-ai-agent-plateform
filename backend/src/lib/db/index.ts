import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function initDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
}

export function getDb() {
  if (!_db) throw new Error("数据库未初始化，请先调用 initDb");
  return _db;
}
