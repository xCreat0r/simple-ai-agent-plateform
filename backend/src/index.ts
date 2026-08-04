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

// 全局错误处理：统一格式化错误响应，认证错误返回 401，其余返回 500
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
  // 将 Cloudflare bindings（如 KV、Hyperdrive 连接串）注入到模块级 holder 中，
  // 便于在非路由上下文（如 waitUntil 后台任务）里也能拿到环境变量
  const { setEnv } = await import("@/lib/env-holder");
  setEnv(c.env);

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

// 受保护路由：所有 /api/agents、/api/chat 等请求先经过 requireUser 认证中间件
const protectedRoutes = new Hono<Env>()
  .use("*", requireUser)
  .route("/agents", agentsRoutes)
  .route("/chat", chatRoutes)
  .route("/chats", chatsRoutes)
  .route("/tools", toolsRoutes)
  .route("/knowledge", knowledgeRoutes);

app.route("/api", protectedRoutes);

// 每个请求使用独立数据库连接（Workers 禁止跨请求复用连接）。
// 包装 fetch：请求入口创建连接，响应 body 流结束后关闭连接。
// 流式响应（/api/chat）期间连接保持可用，直至流写完。
async function handleRequest(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
  const { withDb } = await import("@/lib/db");
  const { getHyperdriveConnectionString } = await import("@/lib/env-holder");
  const connectionString = getHyperdriveConnectionString();

  if (!connectionString) {
    return await app.fetch(request, env, ctx);
  }

  const { result: res, close } = await withDb(connectionString, async () => await app.fetch(request, env, ctx));

  if (!res || !res.body) {
    await close().catch(() => {});
    return res;
  }

  const reader = res.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await close().catch(() => {});
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
        await close().catch(() => {});
      }
    },
    cancel() {
      reader.cancel();
      close().catch(() => {});
    },
  });

  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<CloudflareEnv, unknown, unknown>;

