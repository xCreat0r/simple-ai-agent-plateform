import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();

  const [kb] = await db
    .select()
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, user.id)));
  if (!kb) return notFound("Not found");
  return NextResponse.json(kb);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();

  const [kb] = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, user.id)));
  if (!kb) return notFound("Not found");

  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
  return NextResponse.json({ ok: true });
}
