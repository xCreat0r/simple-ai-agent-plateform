import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { agentsRoutes } from "./routes/agents";
import { chatRoutes } from "./routes/chat";
import { chatsRoutes } from "./routes/chats";
import { toolsRoutes } from "./routes/tools";
import { knowledgeRoutes } from "./routes/knowledge";
import { healthRoutes } from "./routes/health";
import { AuthError } from "./routes/_middleware";

const app = new Hono<{ Bindings: CloudflareEnv }>();

app.onError((err, c) => {
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
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

app.route("/api/auth", authRoutes);
app.route("/api/agents", agentsRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/chats", chatsRoutes);
app.route("/api/tools", toolsRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/health", healthRoutes);

export default app;
