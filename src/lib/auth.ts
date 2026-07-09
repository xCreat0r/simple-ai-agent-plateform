import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { unauthorized } from "@/lib/errors";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: { database: { generateId: false } },
});

export async function getCurrentUser(): Promise<{ id: string; name: string | null } | null> {
  try {
    const { headers } = await import("next/headers");
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) return { id: session.user.id, name: session.user.name };
  } catch (e) {
    console.warn("getCurrentUser: session 获取失败", e);
  }
  return null;
}

export async function requireUser(): Promise<{ id: string; name: string | null }> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
