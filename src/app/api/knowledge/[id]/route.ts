import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.id, id));
  if (!kb) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(kb);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
  return NextResponse.json({ ok: true });
}
