import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeDocuments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const user = await requireUser();

  const [doc] = await db
    .select({ content: knowledgeDocuments.content })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeBases.userId, user.id)))
    .limit(1);

  if (!doc) return notFound("Not found");

  return NextResponse.json({ content: doc.content });
}
