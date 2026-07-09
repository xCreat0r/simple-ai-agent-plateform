import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, agentTools, agentKnowledge } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { parseBody } from "@/lib/validate";
import { createAgentSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id))
    .orderBy(desc(agents.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = parseBody(await req.json(), createAgentSchema);

  const [agent] = await db
    .insert(agents)
    .values({
      userId: user.id,
      name: body.name,
      systemPrompt: body.systemPrompt,
      model: body.model,
      temperature: String(body.temperature),
      maxTokens: body.maxTokens,
    })
    .returning();

  if (body.tools.length > 0) {
    await db.insert(agentTools).values(
      body.tools.map((toolId) => ({
        agentId: agent.id,
        toolId,
      }))
    );
  }

  if (body.knowledgeBaseIds.length > 0) {
    await db.insert(agentKnowledge).values(
      body.knowledgeBaseIds.map((kbId) => ({
        agentId: agent.id,
        kbId,
      }))
    );
  }

  return NextResponse.json(agent, { status: 201 });
}
