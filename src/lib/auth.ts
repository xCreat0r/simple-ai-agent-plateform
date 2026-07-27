import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { unauthorized } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production",
    sendResetPassword: async ({ user, url }) => {
      logger.info({ userId: user.id, email: user.email }, "发送密码重置邮件");
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      logger.info({ userId: user.id, email: user.email }, "发送验证邮件");
    },
  },
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
    logger.warn(e, "getCurrentUser: session 获取失败");
  }
  return null;
}

export async function requireUser(): Promise<{ id: string; name: string | null }> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
