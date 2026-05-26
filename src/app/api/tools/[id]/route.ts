import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tools, agentTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const updateToolSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parameters: z
    .object({
      type: z.literal("object"),
      properties: z.record(
        z.string(),
        z.object({
          type: z.enum(["string", "number", "boolean"]),
          description: z.string().default(""),
        })
      ),
      required: z.array(z.string()).default([]),
    })
    .optional(),
  endpoint: z.string().url().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
});

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
