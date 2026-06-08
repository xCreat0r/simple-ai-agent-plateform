import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: { database: { generateId: false } },
});

export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function getCurrentUser(): Promise<{ id: string; name: string | null }> {
  try {
    const { headers } = await import("next/headers");
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) {
      return { id: session.user.id, name: session.user.name };
    }
  } catch {}
  return { id: GUEST_USER_ID, name: "Guest" };
}
