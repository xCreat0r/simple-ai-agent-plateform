import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools, agentTools } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { updateToolSchema } from "@/lib/validators";
import { notFound } from "@/lib/errors";
import { parseBody } from "@/lib/validate";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();

  const [tool] = await db
    .select()
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, user.id)));
  if (!tool) return notFound("Not found");
  return NextResponse.json(tool);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  const body = parseBody(await req.json(), updateToolSchema);

  const [tool] = await db
    .select({ id: tools.id })
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, user.id)));
  if (!tool) return notFound("Not found");

  await db
    .update(tools)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tools.id, id));

  const [updated] = await db.select().from(tools).where(eq(tools.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();

  const [tool] = await db
    .select({ id: tools.id })
    .from(tools)
    .where(and(eq(tools.id, id), eq(tools.userId, user.id)));
  if (!tool) return notFound("Not found");

  await db.delete(agentTools).where(eq(agentTools.toolId, id));
  await db.delete(tools).where(eq(tools.id, id));
  return NextResponse.json({ ok: true });
}
