import { Hono } from "hono";
import type { Env } from "./_middleware";
import { getDb } from "@/lib/db";
import { knowledgeBases, knowledgeDocuments, knowledgeChunks } from "@/lib/db/schema";
import { eq, desc, and, asc, inArray, sql } from "drizzle-orm";
import { splitText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embedding";
import { generateId } from "@/lib/util/uuid";


const knowledgeRoutes = new Hono<Env>();

knowledgeRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const rows = await getDb()
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, userId))
    .orderBy(desc(knowledgeBases.createdAt));
  return c.json(rows);
});

knowledgeRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const { name } = await c.req.json() as { name: string };
  const kbId = generateId();
  await getDb().insert(knowledgeBases).values({ id: kbId, userId: userId, name, createdAt: new Date() });
  return c.json({ id: kbId, userId: userId, name }, 201);
});

knowledgeRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [kb] = await getDb()
    .select()
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
  if (!kb) return c.json({ error: "Not found" }, 404);
  return c.json(kb);
});

knowledgeRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb();
  const [kb] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
  if (!kb) return c.json({ error: "Not found" }, 404);
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
  return c.json({ ok: true });
});

knowledgeRoutes.get("/:id/documents", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb();

  const [kb] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
  if (!kb) return c.json({ error: "Not found" }, 404);

  const docs = await db
    .select({ id: knowledgeDocuments.id, filename: knowledgeDocuments.filename, createdAt: knowledgeDocuments.createdAt })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.kbId, id))
    .orderBy(asc(knowledgeDocuments.createdAt));

  const docIds = docs.map((d) => d.id);
  const chunkCounts = docIds.length > 0
    ? await db
        .select({ docId: knowledgeChunks.docId, count: sql<number>`count(*)` })
        .from(knowledgeChunks)
        .where(inArray(knowledgeChunks.docId, docIds))
        .groupBy(knowledgeChunks.docId)
    : [];
  const countMap = new Map(chunkCounts.map((c) => [c.docId, c.count]));
  return c.json(docs.map((d) => ({ ...d, chunkCount: countMap.get(d.id) ?? 0 })));
});

knowledgeRoutes.post("/:id/documents", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb();

  const [kb] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
  if (!kb) return c.json({ error: "Not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "未选择文件" }, 400);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) return c.json({ error: "文件过大" }, 400);

  const ALLOWED = new Set([".txt", ".csv", ".json", ".md", ".markdown"]);
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.has(ext)) return c.json({ error: "不支持的文件类型" }, 400);

  const arrBuf = await file.arrayBuffer();
  const text = new TextDecoder().decode(arrBuf);

  if (!text.trim()) return c.json({ error: "文件内容为空" }, 400);

  const docId = generateId();
  const now = new Date();
  await db.insert(knowledgeDocuments).values({ id: docId, kbId: id, filename: file.name, content: text, createdAt: now });

  const chunks = splitText(text);
  if (chunks.length > 0) {
    const embeddings = await generateEmbeddings(chunks);

    const chunkRecords = chunks.map((content, i) => ({
      id: generateId(), docId, kbId: id, content, chunkIndex: i,
      embedding: embeddings[i], createdAt: now,
    }));
    await db.insert(knowledgeChunks).values(chunkRecords);
  }

  return c.json({ id: docId, filename: file.name, chunkCount: chunks.length }, 201);
});

knowledgeRoutes.delete("/:id/documents/:docId", async (c) => {
  const userId = c.get("userId");
  const docId = c.req.param("docId");
  const db = getDb();

  const [doc] = await db
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, userId)))
    .limit(1);
  if (!doc) return c.json({ error: "Not found" }, 404);

  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, docId));
  return c.json({ ok: true });
});

knowledgeRoutes.get("/:id/documents/:docId/content", async (c) => {
  const userId = c.get("userId");
  const docId = c.req.param("docId");
  const [doc] = await getDb()
    .select({ content: knowledgeDocuments.content })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, userId)))
    .limit(1);
  if (!doc) return c.json({ error: "Not found" }, 404);
  return c.json({ content: doc.content });
});

export { knowledgeRoutes };
