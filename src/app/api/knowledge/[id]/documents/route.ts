import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeDocuments, knowledgeChunks } from "@/lib/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { splitText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embedding";
// @ts-ignore pdf-parse v1 has no types
import pdf from "pdf-parse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const docs = await db
    .select({
      id: knowledgeDocuments.id,
      filename: knowledgeDocuments.filename,
      createdAt: knowledgeDocuments.createdAt,
    })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.kbId, id))
    .orderBy(asc(knowledgeDocuments.createdAt));

  const docIds = docs.map((d) => d.id);
  const chunkCounts = docIds.length > 0
    ? await db
        .select({
          docId: knowledgeChunks.docId,
          count: sql<number>`count(*)::int`,
        })
        .from(knowledgeChunks)
        .where(docIds.length === 1
          ? eq(knowledgeChunks.docId, docIds[0])
          : undefined
        )
        .groupBy(knowledgeChunks.docId)
    : [];

  const countMap = new Map(chunkCounts.map((c) => [c.docId, c.count]));

  return NextResponse.json(
    docs.map((d) => ({ ...d, chunkCount: countMap.get(d.id) ?? 0 }))
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "未选择文件" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件过大，请限制在 10MB 以内" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name;
  let text: string;

  if (filename.endsWith(".pdf")) {
    const data = await pdf(buffer);
    text = data.text;
  } else {
    text = new TextDecoder().decode(buffer);
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "文件内容为空" }, { status: 400 });
  }

  const [doc] = await db
    .insert(knowledgeDocuments)
    .values({ kbId: id, filename, content: text })
    .returning();

  const chunks = splitText(text);
  if (chunks.length > 0) {
    const embeddings = await generateEmbeddings(chunks);
    await db.insert(knowledgeChunks).values(
      chunks.map((content, i) => ({
        docId: doc.id,
        kbId: id,
        content,
        embedding: embeddings[i],
        chunkIndex: i,
      }))
    );
  }

  return NextResponse.json({ ...doc, chunkCount: chunks.length }, { status: 201 });
}
