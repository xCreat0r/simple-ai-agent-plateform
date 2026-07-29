import type { Context } from "hono";
import { verifyAccessToken } from "@/lib/jwt";

export class AuthError extends Error {
  constructor(msg = "未登录") {
    super(msg);
    this.name = "AuthError";
  }
}

export async function requireUser(c: Context<{ Bindings: CloudflareEnv }>) {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) throw new AuthError();

  const token = auth.slice(7);
  try {
    const { userId } = await verifyAccessToken(token);
    return { id: userId } as { id: string };
  } catch {
    throw new AuthError("登录已过期");
  }
}
