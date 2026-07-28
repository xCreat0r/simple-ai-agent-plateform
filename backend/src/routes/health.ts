import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

const healthRoutes = new Hono<{ Bindings: CloudflareEnv }>();

healthRoutes.get("/", async (c) => {
  let dbOk = false;
  try {
    await getDb().execute(sql`SELECT 1`);
    dbOk = true;
  } catch {}
  return c.json({
    status: dbOk ? "healthy" : "degraded",
    checks: { database: dbOk ? "ok" : "error" },
    timestamp: new Date().toISOString(),
  });
});

export { healthRoutes };
