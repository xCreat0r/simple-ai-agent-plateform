import { Hono } from "hono";
import type { Env } from "./_middleware";
import { getDb } from "@/lib/db";
import { tools, agentTools } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { parseBody } from "@/lib/validate";
import { createToolSchema, updateToolSchema } from "@/lib/validators";
import { generateId } from "@/lib/util/uuid";
import { getPlan } from "@/lib/quota";

import { getAllBuiltinTools } from "@/lib/tools";

const toolsRoutes = new Hono<Env>();

toolsRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const builtins = getAllBuiltinTools().map((t) => ({
    id: t.id, name: t.name, description: t.description, parameters: t.parameters, builtin: true,
  }));
  const custom = await getDb()
    .select()
    .from(tools)
    .where(eq(tools.userId, userId))
    .orderBy(desc(tools.updatedAt));
  return c.json([...builtins, ...custom]);
});

toolsRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = parseBody(await c.req.json(), createToolSchema);

  // 创建数量配额：达到上限拒绝，防资源滥用
  const plan = getPlan(userId);
  const [countRow] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(tools)
    .where(eq(tools.userId, userId));
  if (Number(countRow?.count ?? 0) >= plan.maxTools) {
    return c.json({ error: `已达创建上限（${plan.maxTools} 个）` }, 429);
  }

  const toolId = generateId();
  const now = new Date();
  await getDb().insert(tools).values({
    id: toolId, userId: userId, name: body.name, description: body.description,
    parameters: JSON.stringify(body.parameters), endpoint: body.endpoint,
    method: body.method, headers: body.headers ? JSON.stringify(body.headers) : null,
    createdAt: now, updatedAt: now,
  });
  return c.json({ id: toolId, ...body, createdAt: now, updatedAt: now, builtin: false }, 201);
});

toolsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [tool] = await getDb()
    .select()
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, userId)));
  if (!tool) return c.json({ error: "Not found" }, 404);
  return c.json(tool);
});

toolsRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = parseBody(await c.req.json(), updateToolSchema);

  const [tool] = await getDb()
    .select({ id: tools.id })
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, userId)));
  if (!tool) return c.json({ error: "Not found" }, 404);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.parameters !== undefined) updateData.parameters = JSON.stringify(body.parameters);
  if (body.endpoint !== undefined) updateData.endpoint = body.endpoint;
  if (body.method !== undefined) updateData.method = body.method;
  if (body.headers !== undefined) updateData.headers = JSON.stringify(body.headers);

  await getDb().update(tools).set(updateData).where(eq(tools.id, id));
  const [updated] = await getDb().select().from(tools).where(eq(tools.id, id));
  return c.json(updated);
});

toolsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [tool] = await getDb()
    .select({ id: tools.id })
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, userId)));
  if (!tool) return c.json({ error: "Not found" }, 404);
  await getDb().delete(agentTools).where(eq(agentTools.toolId, id));
  await getDb().delete(tools).where(eq(tools.id, id));
  return c.json({ ok: true });
});

export { toolsRoutes };
