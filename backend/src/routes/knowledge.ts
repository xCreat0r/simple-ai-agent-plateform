import {Hono} from "hono";
import type {Env} from "./_middleware";
import {getDb, withDb} from "@/lib/db";
import {knowledgeBases, knowledgeDocuments, knowledgeChunks} from "@/lib/db/schema";
import {eq, desc, and, asc, inArray, sql, lt} from "drizzle-orm";
import {splitText} from "@/lib/ai/chunker";
import {generateEmbeddings} from "@/lib/ai/embedding";
import {parsePdfBytes, PdfUserError} from "@/lib/ai/pdf";
import {generateId} from "@/lib/util/uuid";
import {getHyperdriveConnectionString} from "@/lib/env-holder";
import {config} from "@/lib/config";
import {checkRateLimit} from "@/lib/rate-limit";
import {checkKnowledgeStorage} from "@/lib/quota";
import {deduplicateChunks} from "@/lib/util/text";
import {decodeTextBuffer} from "@/lib/util/encoding";
import {logger} from "@/lib/logger";


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
    const {name} = await c.req.json() as { name: string };
    const kbId = generateId();
    await getDb().insert(knowledgeBases).values({id: kbId, userId: userId, name, createdAt: new Date()});
    return c.json({id: kbId, userId: userId, name}, 201);
});

knowledgeRoutes.get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const [kb] = await getDb()
        .select()
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
    if (!kb) return c.json({error: "Not found"}, 404);
    return c.json(kb);
});

knowledgeRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const db = getDb();
    const [kb] = await db
        .select({id: knowledgeBases.id})
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
    if (!kb) return c.json({error: "Not found"}, 404);
    await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
    return c.json({ok: true});
});

knowledgeRoutes.get("/:id/documents", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const db = getDb();

    const [kb] = await db
        .select({id: knowledgeBases.id})
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
    if (!kb) return c.json({error: "Not found"}, 404);

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
            .select({docId: knowledgeChunks.docId, count: sql<number>`count(*)`})
            .from(knowledgeChunks)
            .where(inArray(knowledgeChunks.docId, docIds))
            .groupBy(knowledgeChunks.docId)
        : [];
    const countMap = new Map(chunkCounts.map((c) => [c.docId, Number(c.count)]));
    return c.json(docs.map((d) => ({...d, chunkCount: countMap.get(d.id) ?? 0})));
});

knowledgeRoutes.post("/:id/documents", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const db = getDb();
    // 校验知识库归属
    const [kb] = await db
        .select({id: knowledgeBases.id})
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, userId)));
    if (!kb) return c.json({error: "Not found"}, 404);

    // 上传限流：PDF 解析在主请求路径同步执行（最多 30s），
    // 该接口是唯一的 CPU 消耗型入口，需防滥用；超限直接 429，不读取文件
    const uploadRl = await checkRateLimit(
        `kb-upload:${userId}`,
        config.knowledge.uploadRatePerWindow,
        config.rateLimit.windowMs
    );
    if (!uploadRl.allowed) return c.json({error: "请求过于频繁"}, 429);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({error: "未选择文件"}, 400);

    // 文件大小与存储配额双重校验
    const MAX_FILE_SIZE = config.knowledge.maxFileSize;
    if (file.size > MAX_FILE_SIZE) return c.json({error: "文件过大"}, 400);

    const storage = await checkKnowledgeStorage(userId, file.size);
    if (!storage.allowed) return c.json({error: storage.reason || "存储配额不足"}, 413);

    // 白名单校验扩展名
    const ALLOWED = new Set([".pdf", ".txt", ".csv", ".json", ".md", ".markdown"]);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.has(ext)) return c.json({error: "不支持的文件类型"}, 400);

    // 提取文本：PDF 走 Python base 解析服务，其余按编码探测解码（自动识别 UTF-8 / GBK）
    const arrBuf = await file.arrayBuffer();
    let text: string;
    if (ext === ".pdf") {
        try {
            text = await parsePdf(arrBuf);
        } catch (err) {
            // 解析失败返回白名单错误文案，不落库；
            // PdfUserError.message 为可读文案，其余异常回通用文案并记日志
            if (err instanceof PdfUserError) {
                return c.json({error: err.message}, 422);
            }
            console.error("[knowledge] PDF 解析异常:", err);
            return c.json({error: "PDF 解析失败"}, 422);
        }
    } else {
        text = decodeTextBuffer(arrBuf);
    }

    if (!text.trim()) return c.json({error: "文件内容为空"}, 400);

    // 先落库文档记录（状态 processing），再异步执行嵌入，避免阻塞请求
    const docId = generateId();
    const now = new Date();
    await db.insert(knowledgeDocuments).values({
        id: docId, kbId: id, filename: file.name, sizeBytes: file.size,
        status: "processing", createdAt: now,
    });

    const chunks = splitText(text);
    logger.metric("knowledge.document_uploaded", {
        docId, kbId: id, filename: file.name, sizeBytes: file.size, ext, chunks: chunks.length,
    });
    // waitUntil 让 embedding 在响应返回后继续执行（Cloudflare 后台任务）。
    // 后台任务运行在请求上下文之外，需用独立连接执行。
    const connString = getHyperdriveConnectionString();
    if (connString) {
        c.executionCtx.waitUntil(
            withDb(connString, () => processEmbedding(docId, id, chunks, now)).then(() => {
            })
        );
    }

    return c.json({id: docId, filename: file.name, chunkCount: chunks.length, status: "processing"}, 202);
});

knowledgeRoutes.delete("/:id/documents/:docId", async (c) => {
    const userId = c.get("userId");
    const docId = c.req.param("docId");
    const db = getDb();

    const [doc] = await db
        .select({id: knowledgeDocuments.id})
        .from(knowledgeDocuments)
        .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
        .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, userId)))
        .limit(1);
    if (!doc) return c.json({error: "Not found"}, 404);

    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, docId));
    return c.json({ok: true});
});

knowledgeRoutes.get("/:id/documents/:docId/content", async (c) => {
    const userId = c.get("userId");
    const docId = c.req.param("docId");
    const [doc] = await getDb()
        .select({id: knowledgeDocuments.id})
        .from(knowledgeDocuments)
        .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
        .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, userId)))
        .limit(1);
    if (!doc) return c.json({error: "Not found"}, 404);

    const chunks = await getDb()
        .select({content: knowledgeChunks.content})
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.docId, docId))
        .orderBy(asc(knowledgeChunks.chunkIndex));

    const content = deduplicateChunks(chunks.map((c) => c.content)).join("\n\n");
    return c.json({content});
});

async function processEmbedding(docId: string, kbId: string, chunks: string[], createdAt: Date): Promise<void> {
    const db = getDb();
    const batchSize = config.knowledge.embeddingBatchSize;
    const provider = process.env.EMBEDDING_PROVIDER || "workers-ai";
    const startedAt = Date.now();
    try {
        // 文档可能在排队期间被删除，先确认仍存在，避免空跑撞外键
        const [doc] = await db
            .select({id: knowledgeDocuments.id})
            .from(knowledgeDocuments)
            .where(eq(knowledgeDocuments.id, docId));
        if (!doc) {
            logger.warn(`[embedding] 文档 ${docId} 已被删除，跳过嵌入`);
            return;
        }
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
            .set({status: "ready"})
            .where(eq(knowledgeDocuments.id, docId));
        logger.metric("knowledge.embedding_success", {
            docId, kbId, chunks: chunks.length, elapsedMs: Date.now() - startedAt, provider,
        });
    } catch (err) {
        // 任一环节失败则标记 failed 并记录错误信息，供前端展示
        const message = err instanceof Error ? err.message : "未知错误";
        await db.update(knowledgeDocuments)
            .set({status: "failed", error: message})
            .where(eq(knowledgeDocuments.id, docId));
        logger.metric("knowledge.embedding_failed", {
            docId, kbId, error: message, elapsedMs: Date.now() - startedAt, provider,
        });
    }
}

// 回收超时卡在 processing 的文档（由 scheduled cron 触发）。
// 返回被标记为 failed 的文档数量；超时阈值默认 30 分钟。
export async function recoverStaleProcessingDocs(timeoutMs = 30 * 60 * 1000): Promise<number> {
    const db = getDb();
    const cutoff = new Date(Date.now() - timeoutMs);
    const stale = await db
        .select({id: knowledgeDocuments.id})
        .from(knowledgeDocuments)
        .where(and(eq(knowledgeDocuments.status, "processing"), lt(knowledgeDocuments.createdAt, cutoff)));
    if (stale.length === 0) return 0;

    const ids = stale.map((s) => s.id);
    await db.update(knowledgeDocuments)
        .set({status: "failed", error: "处理超时，请删除后重新上传"})
        .where(inArray(knowledgeDocuments.id, ids));
    return ids.length;
}

async function parsePdf(arrBuf: ArrayBuffer): Promise<string> {
    // Worker 内本地解析（unpdf / PDF.js），不再依赖独立 base 服务
    return parsePdfBytes(arrBuf);
}

export {knowledgeRoutes};
