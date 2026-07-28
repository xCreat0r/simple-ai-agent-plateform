import type { Context } from "hono";
import { getAuth } from "@/lib/auth";

export class AuthError extends Error {
  constructor(msg = "未登录") {
    super(msg);
    this.name = "AuthError";
  }
}

export async function requireUser(c: Context<{ Bindings: CloudflareEnv }>) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new AuthError();
  return session.user;
}
