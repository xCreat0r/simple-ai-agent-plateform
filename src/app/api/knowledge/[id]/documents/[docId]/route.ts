import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeDocuments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, docId));
  return NextResponse.json({ ok: true });
}
