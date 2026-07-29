import type { Context, Next } from "hono";
import { verifyAccessToken } from "@/lib/jwt";

export type Env = { Bindings: CloudflareEnv; Variables: { userId: string } };

export class AuthError extends Error {
  constructor(msg = "未登录") {
    super(msg);
    this.name = "AuthError";
  }
}

export async function requireUser(c: Context<Env>, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) throw new AuthError();

  const token = auth.slice(7);
  try {
    const { userId } = await verifyAccessToken(token);
    c.set("userId", userId);
  } catch {
    throw new AuthError("登录已过期");
  }

  await next();
}
