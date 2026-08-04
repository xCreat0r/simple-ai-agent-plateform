import { Hono } from "hono";
import type { Env } from "./_middleware";
import { getDb, withDb } from "@/lib/db";
import { knowledgeBases, knowledgeDocuments, knowledgeChunks } from "@/lib/db/schema";
import { eq, desc, and, asc, inArray, sql } from "drizzle-orm";
import { splitText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embedding";
import { generateId } from "@/lib/util/uuid";
import { getCloudflareContext, getHyperdriveConnectionString } from "@/lib/env-holder";
import { config } from "@/lib/config";
import { checkKnowledgeStorage } from "@/lib/quota";
import { deduplicateChunks } from "@/lib/util/text";


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
    .select({
      id: knowledgeDocuments.id,
      filename: knowledgeDocuments.filename,
      sizeBytes: knowledgeDocuments.sizeBytes,
      status: knowledgeDocuments.status,
      error: knowledgeDocuments.error,
      createdAt: knowledgeDocuments.createdAt,
    })
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
  const countMap = new Map(chunkCounts.map((c) => [c.docId, Number(c.count)]));
  return c.json(docs.map((d) => ({ ...d, chunkCount: countMap.get(d.id) ?? 0 })));
});

knowledgeRoutes.post("/:id/documents", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb();

  // 校验知识库归属
  const [kb] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
  if (!kb) return c.json({ error: "Not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "未选择文件" }, 400);

  // 文件大小与存储配额双重校验
  const MAX_FILE_SIZE = config.knowledge.maxFileSize;
  if (file.size > MAX_FILE_SIZE) return c.json({ error: "文件过大" }, 400);

  const storage = await checkKnowledgeStorage(userId, file.size);
  if (!storage.allowed) return c.json({ error: storage.reason || "存储配额不足" }, 413);

  // 白名单校验扩展名
  const ALLOWED = new Set([".pdf", ".txt", ".csv", ".json", ".md", ".markdown"]);
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.has(ext)) return c.json({ error: "不支持的文件类型" }, 400);

  // 提取文本：PDF 走 Go 解析服务，其余直接按 UTF-8 解码
  const arrBuf = await file.arrayBuffer();
  const text = ext === ".pdf"
    ? await parsePdf(arrBuf)
    : new TextDecoder().decode(arrBuf);

  if (!text.trim()) return c.json({ error: "文件内容为空" }, 400);

  // 先落库文档记录（状态 processing），再异步执行嵌入，避免阻塞请求
  const docId = generateId();
  const now = new Date();
  await db.insert(knowledgeDocuments).values({
    id: docId, kbId: id, filename: file.name, sizeBytes: file.size,
    status: "processing", createdAt: now,
  });

  const chunks = splitText(text);
  // waitUntil 让 embedding 在响应返回后继续执行（Cloudflare 后台任务）。
  // 后台任务运行在请求上下文之外，需用独立连接执行。
  const connString = getHyperdriveConnectionString();
  if (connString) {
    c.executionCtx.waitUntil(
      withDb(connString, () => processEmbedding(docId, id, chunks, now)).then(() => {})
    );
  }

  return c.json({ id: docId, filename: file.name, chunkCount: chunks.length, status: "processing" }, 202);
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
    .select({ id: knowledgeDocuments.id })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, userId)))
    .limit(1);
  if (!doc) return c.json({ error: "Not found" }, 404);

  const chunks = await getDb()
    .select({ content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.docId, docId))
    .orderBy(asc(knowledgeChunks.chunkIndex));

  const content = deduplicateChunks(chunks.map((c) => c.content)).join("\n\n");
  return c.json({ content });
});

async function processEmbedding(docId: string, kbId: string, chunks: string[], createdAt: Date): Promise<void> {
  const db = getDb();
  const batchSize = config.knowledge.embeddingBatchSize;
  try {
    // 分批生成嵌入并落库，避免一次性请求过多文本
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch);
      const records = batch.map((content, j) => ({
        id: generateId(),
        docId,
        kbId,
        content,
        chunkIndex: i + j,
        embedding: embeddings[j],
        createdAt,
      }));
      await db.insert(knowledgeChunks).values(records);
    }
    // 全部成功则标记文档 ready
    await db.update(knowledgeDocuments)
      .set({ status: "ready" })
      .where(eq(knowledgeDocuments.id, docId));
  } catch (err) {
    // 任一环节失败则标记 failed 并记录错误信息，供前端展示
    const message = err instanceof Error ? err.message : "未知错误";
    await db.update(knowledgeDocuments)
      .set({ status: "failed", error: message })
      .where(eq(knowledgeDocuments.id, docId));
  }
}

async function parsePdf(arrBuf: ArrayBuffer): Promise<string> {
  const { env } = getCloudflareContext();
  const baseUrl = env.BASE_SERVICE_URL;
  if (!baseUrl) throw new Error("未配置 BASE_SERVICE_URL");

  // 将 PDF 原始字节转发给 Python base 服务解析文本
  const res = await fetch(`${baseUrl}/doc-parser/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: arrBuf,
  });
  if (!res.ok) {
    throw new Error(`PDF 解析服务返回 ${res.status}: ${await res.text()}`);
  }
  return await res.text();
}

export { knowledgeRoutes };
