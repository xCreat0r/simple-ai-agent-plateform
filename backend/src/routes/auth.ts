import { Hono } from "hono";
import { getAuth } from "@/lib/auth";

const authRoutes = new Hono<{ Bindings: CloudflareEnv }>();

authRoutes.all("*", async (c) => {
  const auth = await getAuth();
  return auth.handler(c.req.raw);
});

export { authRoutes };
