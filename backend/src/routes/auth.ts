import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, refreshTokens } from "@/lib/db/schema";
import { signAccessToken, verifyAccessToken, generateRefreshToken } from "@/lib/jwt";
import { generateId } from "@/lib/util/uuid";
import { AuthError } from "./_middleware";

const authRoutes = new Hono<{ Bindings: CloudflareEnv }>();

const COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "Lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60,
};

function getMetaFromCookie(c: any): string | undefined {
  return getCookie(c, "refresh_token");
}

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

async function rotateRefreshToken(c: any, oldToken: string, userId: string) {
  await getDb().delete(refreshTokens).where(eq(refreshTokens.token, oldToken));
  await setRefreshTokenCookie(c, userId);
}

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
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) {
    return c.json({ error: "邮箱、密码、名称为必填项" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "密码长度不能少于6位" }, 400);
  }

  const existing = await getDb().select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return c.json({ error: "邮箱已注册" }, 400);
  }

  const id = generateId();
  const now = new Date();
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
