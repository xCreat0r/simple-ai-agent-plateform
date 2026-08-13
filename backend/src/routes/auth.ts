import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, refreshTokens } from "@/lib/db/schema";
import { signAccessToken, verifyAccessToken, generateRefreshToken } from "@/lib/jwt";
import { generateId } from "@/lib/util/uuid";
import { AuthError } from "./_middleware";
import { checkRateLimit } from "@/lib/rate-limit";
import { config } from "@/lib/config";

const authRoutes = new Hono<{ Bindings: CloudflareEnv }>();

// 公开配置：供前端判断注册开关等无需登录即可读取的配置项
authRoutes.get("/config", async (c) => {
  return c.json({ allowSignup: config.auth.allowSignup });
});

// 客户端 IP：优先 cf-connecting-ip（Cloudflare 提供），本地回退 x-forwarded-for
function clientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// 认证接口限流：超限返回 429（防暴力破解/接口滥用）
async function enforceAuthRateLimit(c: Context, scope: string, maxPerWindow: number): Promise<boolean> {
  const rl = await checkRateLimit(
    `auth:${scope}:${clientIp(c)}`,
    maxPerWindow,
    config.rateLimit.windowMs
  );
  if (!rl.allowed) {
    c.json({ error: "请求过于频繁" }, 429);
    return false;
  }
  return true;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "Lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60,
};

// 从请求 cookie 中读取 refresh token
function getMetaFromCookie(c: any): string | undefined {
  return getCookie(c, "refresh_token");
}

// 生成 refresh token：写入数据库（用于撤销/校验）+ 下发 HttpOnly cookie
async function setRefreshTokenCookie(c: any, userId: string) {
  const token = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await getDb().insert(refreshTokens).values({
    id: generateId(),
    token,
    userId,
    expiresAt,
    createdAt: now,
  });

  setCookie(c, "refresh_token", token, COOKIE_OPTIONS);
  return token;
}

// 刷新令牌轮换：旧 token 一次性使用，用后即删，防止重放攻击
async function rotateRefreshToken(c: any, oldToken: string, userId: string) {
  await getDb().delete(refreshTokens).where(eq(refreshTokens.token, oldToken));
  await setRefreshTokenCookie(c, userId);
}

// 根据 refresh token 查找用户：不存在或已过期返回 null
async function getUserFromRefreshToken(token: string) {
  const now = new Date();
  const [row] = await getDb()
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token));
  if (!row || row.expiresAt <= now) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, row.userId));
  return user;
}

authRoutes.post("/sign-up/email", async (c) => {
  if (!(await enforceAuthRateLimit(c, "signup", 20))) return;
  // 注册开关：生产环境可设 ALLOW_SIGNUP=false 关闭公开注册，仅管理员创建账号
  if (!config.auth.allowSignup) {
    return c.json({ error: "注册已关闭" }, 403);
  }
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) {
    return c.json({ error: "邮箱、密码、名称为必填项" }, 400);
  }
  if (password.length < config.auth.minPasswordLength) {
    return c.json({ error: `密码长度不能少于${config.auth.minPasswordLength}位` }, 400);
  }

  const existing = await getDb().select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return c.json({ error: "邮箱已注册" }, 400);
  }

  const id = generateId();
  const now = new Date();
  // 密码使用 bcrypt 加盐哈希后存储，绝不明文保存
  const passwordHash = await hash(password, 10);

  await getDb().insert(users).values({
    id, email, name,
    passwordHash,
    provider: "email",
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  const user = { id, name };
  const accessToken = await signAccessToken(id);
  await setRefreshTokenCookie(c, id);

  return c.json({ user, accessToken }, 201);
});

authRoutes.post("/sign-in/email", async (c) => {
  if (!(await enforceAuthRateLimit(c, "signin", 10))) return;
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: "邮箱和密码为必填项" }, 400);
  }

  const [user] = await getDb().select().from(users).where(eq(users.email, email));
  if (!user || !user.passwordHash) {
    return c.json({ error: "邮箱或密码错误" }, 401);
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "邮箱或密码错误" }, 401);
  }

  const accessToken = await signAccessToken(user.id);
  await setRefreshTokenCookie(c, user.id);

  return c.json({ user: { id: user.id, name: user.name }, accessToken });
});

authRoutes.post("/refresh", async (c) => {
  if (!(await enforceAuthRateLimit(c, "refresh", 30))) return;
  const token = getMetaFromCookie(c);
  if (!token) throw new AuthError();

  const user = await getUserFromRefreshToken(token);
  if (!user) throw new AuthError();

  await rotateRefreshToken(c, token, user.id);
  const accessToken = await signAccessToken(user.id);

  return c.json({ user: { id: user.id, name: user.name }, accessToken });
});

authRoutes.post("/sign-out", async (c) => {
  const token = getMetaFromCookie(c);
  if (token) {
    await getDb().delete(refreshTokens).where(eq(refreshTokens.token, token));
  }
  deleteCookie(c, "refresh_token", COOKIE_OPTIONS);
  return c.json({ ok: true });
});

authRoutes.get("/session", async (c) => {
  const token = getMetaFromCookie(c);
  if (!token) return c.json({ user: null });

  const user = await getUserFromRefreshToken(token);
  if (!user) return c.json({ user: null });

  return c.json({ user: { id: user.id, name: user.name } });
});

export { authRoutes };
