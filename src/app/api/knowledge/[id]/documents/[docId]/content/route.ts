import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeDocuments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const [doc] = await db
    .select({ content: knowledgeDocuments.content })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, docId));

  if (!doc) return notFound("Not found");

  return NextResponse.json({ content: doc.content });
}
