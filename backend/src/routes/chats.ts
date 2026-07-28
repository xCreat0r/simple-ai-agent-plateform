import { Hono } from "hono";
import { getDb } from "@/lib/db";
import { agents, chats, messages } from "@/lib/db/schema";
import { eq, desc, and, asc, lt } from "drizzle-orm";
import { parseBody } from "@/lib/validate";
import { createChatSchema } from "@/lib/validators";
import { generateId } from "@/lib/util/uuid";
import { requireUser } from "./_middleware";

const chatsRoutes = new Hono<{ Bindings: CloudflareEnv }>();

chatsRoutes.get("/", async (c) => {
  const user = await requireUser(c);
  const agentId = c.req.query("agentId");
  if (!agentId) return c.json({ error: "agentId required" }, 400);

  const [agent] = await getDb()
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  const rows = await getDb()
    .select()
    .from(chats)
    .where(eq(chats.agentId, agentId))
    .orderBy(desc(chats.createdAt));
  return c.json(rows);
});

chatsRoutes.post("/", async (c) => {
  const user = await requireUser(c);
  const body = parseBody(await c.req.json(), createChatSchema);

  const [agent] = await getDb()
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, body.agentId), eq(agents.userId, user.id)));
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  const chatId = generateId();
  await getDb().insert(chats).values({
    id: chatId, agentId: body.agentId,
    title: body.title || "新对话", createdAt: new Date(),
  });
  return c.json({ id: chatId, agentId: body.agentId, title: body.title || "新对话" }, 201);
});

chatsRoutes.patch("/:id", async (c) => {
  const user = await requireUser(c);
  const id = c.req.param("id");
  const { title } = await c.req.json() as { title?: string };
  if (!title) return c.json({ error: "title required" }, 400);

  const [chat] = await getDb()
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(agents, eq(chats.agentId, agents.id))
    .where(and(eq(chats.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!chat) return c.json({ error: "Not found" }, 404);

  await getDb().update(chats).set({ title }).where(eq(chats.id, id));
  return c.json({ ok: true });
});

chatsRoutes.delete("/:id", async (c) => {
  const user = await requireUser(c);
  const id = c.req.param("id");

  const [chat] = await getDb()
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(agents, eq(chats.agentId, agents.id))
    .where(and(eq(chats.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!chat) return c.json({ error: "Not found" }, 404);

  await getDb().delete(chats).where(eq(chats.id, id));
  return c.json({ ok: true });
});

chatsRoutes.get("/:id/messages", async (c) => {
  const user = await requireUser(c);
  const id = c.req.param("id");

  const [chat] = await getDb()
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(agents, eq(chats.agentId, agents.id))
    .where(and(eq(chats.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!chat) return c.json({ error: "Not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const before = c.req.query("before");

  const rows = await getDb()
    .select({ id: messages.id, role: messages.role, content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(before ? and(eq(messages.chatId, id), lt(messages.createdAt, new Date(before))) : eq(messages.chatId, id))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const hasMore = rows.length === limit;
  const cursor = hasMore ? rows[rows.length - 1].createdAt.toISOString() : null;
  return c.json({ messages: rows.reverse(), cursor, hasMore });
});

export { chatsRoutes };
