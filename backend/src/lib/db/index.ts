// Cloudflare Workers 禁止跨请求复用 postgres 连接（Cannot perform I/O on behalf of a different request）。
// 因此每个请求创建独立的连接池。AsyncLocalStorage 用于在请求的异步链中共享连接句柄，
// 避免跨请求串用（workerd 会把连接绑定到创建它的请求上下文）。
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle>;

interface DbContext {
  db: Db;
  end: () => Promise<void>;
}

// AsyncLocalStorage 类型来自 @types/node；若未配置 tsconfig types，
// 用轻量类型声明避免引入全局 node 类型
const dbContext = new AsyncLocalStorage<DbContext>();

export function initDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });
  return { db, end: () => client.end() };
}

export function getDb() {
  const ctx = dbContext.getStore();
  if (!ctx) throw new Error("数据库未初始化，请先调用 withDb");
  return ctx.db;
}

// 在请求上下文内执行 fn，并返回该请求专属连接的关闭函数（由调用方决定何时释放）
export async function withDb<T>(
  connectionString: string,
  fn: () => Promise<T>
): Promise<{ result: T; close: () => Promise<void> }> {
  const { db, end } = initDb(connectionString);
  const ctx: DbContext = { db, end };
  const result = await dbContext.run(ctx, fn);
  return { result, close: () => ctx.end() };
}
