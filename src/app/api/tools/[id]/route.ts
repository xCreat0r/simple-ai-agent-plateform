import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools, agentTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateToolSchema } from "@/lib/validators";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [tool] = await db.select().from(tools).where(eq(tools.id, id));
  if (!tool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tool);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = updateToolSchema.parse(await req.json());

  await db
    .update(tools)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tools.id, id));

  const [tool] = await db.select().from(tools).where(eq(tools.id, id));
  return NextResponse.json(tool);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(agentTools).where(eq(agentTools.toolId, id));
  await db.delete(tools).where(eq(tools.id, id));
  return NextResponse.json({ ok: true });
}
