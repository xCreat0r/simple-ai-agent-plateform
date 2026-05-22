import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  tools: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const toolRows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, id));

  return NextResponse.json({
    ...agent,
    tools: toolRows.map((r) => r.toolId),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = updateAgentSchema.parse(await req.json());

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
  if (body.model !== undefined) updateData.model = body.model;
  if (body.temperature !== undefined) updateData.temperature = String(body.temperature);
  if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date();
    await db.update(agents).set(updateData).where(eq(agents.id, id));
  }

  if (body.tools !== undefined) {
    await db.delete(agentTools).where(eq(agentTools.agentId, id));
    if (body.tools.length > 0) {
      await db.insert(agentTools).values(
        body.tools.map((toolId) => ({ agentId: id, toolId }))
      );
    }
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  const toolRows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, id));

  return NextResponse.json({
    ...agent,
    tools: toolRows.map((r) => r.toolId),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
