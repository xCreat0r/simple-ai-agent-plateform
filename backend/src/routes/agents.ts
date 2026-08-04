import { Hono } from "hono";
import { getDb } from "@/lib/db";
import { agents, agentTools, agentKnowledge, tools, knowledgeBases } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { parseBody } from "@/lib/validate";
import { createAgentSchema, updateAgentSchema } from "@/lib/validators";
import { generateId } from "@/lib/util/uuid";
import type { Env } from "./_middleware";


const agentsRoutes = new Hono<Env>();

agentsRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const db = getDb();
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(desc(agents.updatedAt));

  // 批量查询关联的工具与知识库，避免 N+1
  const agentIds = rows.map((r) => r.id);
  const toolRows = agentIds.length > 0
    ? await db.select().from(agentTools).where(inArray(agentTools.agentId, agentIds))
    : [];
  const kbRows = agentIds.length > 0
    ? await db.select().from(agentKnowledge).where(inArray(agentKnowledge.agentId, agentIds))
    : [];

  const toolMap = new Map<string, string[]>();
  for (const r of toolRows) {
    const arr = toolMap.get(r.agentId) || [];
    arr.push(r.toolId);
    toolMap.set(r.agentId, arr);
  }
  const kbMap = new Map<string, string[]>();
  for (const r of kbRows) {
    const arr = kbMap.get(r.agentId) || [];
    arr.push(r.kbId);
    kbMap.set(r.agentId, arr);
  }

  return c.json(rows.map((r) => ({
    ...r,
    tools: toolMap.get(r.id) || [],
    knowledgeBaseIds: kbMap.get(r.id) || [],
  })));
});

agentsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [agent] = await getDb()
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  if (!agent) return c.json({ error: "Not found" }, 404);

  const toolRows = await getDb().select().from(agentTools).where(eq(agentTools.agentId, id));
  const kbRows = await getDb().select().from(agentKnowledge).where(eq(agentKnowledge.agentId, id));

  return c.json({
    ...agent,
    tools: toolRows.map((r) => r.toolId),
    knowledgeBaseIds: kbRows.map((r) => r.kbId),
  });
});

agentsRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = parseBody(await c.req.json(), createAgentSchema);

  const db = getDb();
  if (body.tools.length > 0) {
    const existing = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(inArray(tools.id, body.tools), eq(tools.userId, userId)));
    if (existing.length !== body.tools.length) {
      return c.json({ error: "部分工具不存在或无权访问" }, 400);
    }
  }
  if (body.knowledgeBaseIds.length > 0) {
    const existing = await db
      .select({ id: knowledgeBases.id })
      .from(knowledgeBases)
      .where(and(inArray(knowledgeBases.id, body.knowledgeBaseIds), eq(knowledgeBases.userId, userId)));
    if (existing.length !== body.knowledgeBaseIds.length) {
      return c.json({ error: "部分知识库不存在或无权访问" }, 400);
    }
  }

  const agentId = generateId();
  const now = new Date();
  await db.insert(agents).values({
    id: agentId, userId: userId, name: body.name,
    systemPrompt: body.systemPrompt, model: body.model,
    temperature: body.temperature, maxTokens: body.maxTokens,
    createdAt: now, updatedAt: now,
  });
  if (body.tools.length > 0) {
    await db.insert(agentTools).values(body.tools.map((t) => ({ agentId, toolId: t })));
  }
  if (body.knowledgeBaseIds.length > 0) {
    await db.insert(agentKnowledge).values(body.knowledgeBaseIds.map((k) => ({ agentId, kbId: k })));
  }

  return c.json({ id: agentId, ...body, createdAt: now, updatedAt: now }, 201);
});

agentsRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = parseBody(await c.req.json(), updateAgentSchema);

  const db = getDb();
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  if (!agent) return c.json({ error: "Not found" }, 404);

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
  if (body.model !== undefined) updateData.model = body.model;
  if (body.temperature !== undefined) updateData.temperature = body.temperature;
  if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date();
    await db.update(agents).set(updateData).where(eq(agents.id, id));
  }
  if (body.tools !== undefined) {
    await db.delete(agentTools).where(eq(agentTools.agentId, id));
    if (body.tools.length > 0) {
      await db.insert(agentTools).values(body.tools.map((t) => ({ agentId: id, toolId: t })));
    }
  }
  if (body.knowledgeBaseIds !== undefined) {
    await db.delete(agentKnowledge).where(eq(agentKnowledge.agentId, id));
    if (body.knowledgeBaseIds.length > 0) {
      await db.insert(agentKnowledge).values(body.knowledgeBaseIds.map((k) => ({ agentId: id, kbId: k })));
    }
  }

  const [updated] = await db.select().from(agents).where(eq(agents.id, id));
  const toolRows = await db.select().from(agentTools).where(eq(agentTools.agentId, id));
  const kbRows = await db.select().from(agentKnowledge).where(eq(agentKnowledge.agentId, id));
  return c.json({ ...updated, tools: toolRows.map((r) => r.toolId), knowledgeBaseIds: kbRows.map((r) => r.kbId) });
});

agentsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [agent] = await getDb()
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));
  if (!agent) return c.json({ error: "Not found" }, 404);
  await getDb().delete(agents).where(eq(agents.id, id));
  return c.json({ ok: true });
});

export { agentsRoutes };
