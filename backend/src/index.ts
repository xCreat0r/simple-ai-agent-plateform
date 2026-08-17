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

// CORS 白名单：CORS_ORIGINS（逗号分隔）环境变量覆盖，默认本地 + 预设生产域名
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173,https://app.agent-platform.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  origin: CORS_ORIGINS,
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
  try {
    const { setEnv, getHyperdriveConnectionString } = await import("@/lib/env-holder");
    // 先注入环境（绑定/secret），后续在 app.fetch 前的 getHyperdriveConnectionString
    // 才能读到 HYPERDRIVE 连接串；否则会误回退到 process.env.DATABASE_URL
    setEnv(env);
    const { withDb } = await import("@/lib/db");
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
  } catch (err) {
    // 数据库建连/初始化等发生在 Hono onError 之外的异常，统一为 JSON 500
    console.error("[ERROR] 请求处理失败", err);
    return new Response(JSON.stringify({ error: "服务器内部错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// scheduled 事件（cron）：无请求上下文，需先注入 env 并单独建立 DB 连接，
// 用于回收超时卡在 processing 的知识库文档（见 knowledge.ts recoverStaleProcessingDocs）
async function handleScheduled(env: CloudflareEnv): Promise<void> {
  const { setEnv, getHyperdriveConnectionString } = await import("@/lib/env-holder");
  setEnv(env);
  const { withDb } = await import("@/lib/db");
  const connectionString = getHyperdriveConnectionString();
  if (!connectionString) return;

  await withDb(connectionString, async () => {
    const { recoverStaleProcessingDocs } = await import("@/routes/knowledge");
    const recovered = await recoverStaleProcessingDocs();
    if (recovered > 0) console.log(`[cron] 回收 ${recovered} 个超时处理中的文档`);
  });
}

export default {
  fetch: handleRequest,
  scheduled(_controller, env) {
    return handleScheduled(env);
  },
} satisfies ExportedHandler<CloudflareEnv, unknown, unknown>;

