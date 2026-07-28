import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

let _auth: any = null;

async function initAuth() {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  _auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: process.env.NODE_ENV === "production",
    },
    user: { modelName: "users" },
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    trustedOrigins: ["http://localhost:5173", "https://app.agent-platform.com"],
    advanced: { database: { generateId: false } },
  });
}

async function getAuth(): Promise<any> {
  if (!_auth) await initAuth();
  return _auth!;
}

export { getAuth };
