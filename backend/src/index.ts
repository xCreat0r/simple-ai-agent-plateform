import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { agentsRoutes } from "./routes/agents";
import { chatRoutes } from "./routes/chat";
import { chatsRoutes } from "./routes/chats";
import { toolsRoutes } from "./routes/tools";
import { knowledgeRoutes } from "./routes/knowledge";
import { healthRoutes } from "./routes/health";
import { AuthError, requireUser } from "./routes/_middleware";
import type { Env } from "./routes/_middleware";

const app = new Hono<{ Bindings: CloudflareEnv }>();

app.onError((err, c) => {
  console.error("[ERROR]", err.name, err.message);
  console.error(err.stack);
  if ((err as any).cause) console.error("Caused by:", (err as any).cause);
  if (err instanceof AuthError) {
    return c.json({ error: err.message }, 401);
  }
  return c.json({ error: "服务器内部错误" }, 500);
});

app.use("*", async (c, next) => {
  const { setEnv, getHyperdriveConnectionString } = await import("@/lib/env-holder");
  setEnv(c.env);

  const { initDb } = await import("@/lib/db");
  const connectionString = getHyperdriveConnectionString();
  if (connectionString) {
    initDb(connectionString);
  }

  await next();
});

app.use("*", cors({
  origin: ["http://localhost:5173", "https://app.agent-platform.com"],
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
}));

app.route("/api/auth", authRoutes);
app.route("/api/health", healthRoutes);

const protectedRoutes = new Hono<Env>()
  .use("*", requireUser)
  .route("/agents", agentsRoutes)
  .route("/chat", chatRoutes)
  .route("/chats", chatsRoutes)
  .route("/tools", toolsRoutes)
  .route("/knowledge", knowledgeRoutes);

app.route("/api", protectedRoutes);

export default app;
