import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, agentTools, agentKnowledge, tools, knowledgeBases } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq, desc, inArray } from "drizzle-orm";
import { parseBody } from "@/lib/validate";
import { createAgentSchema } from "@/lib/validators";
import { badRequest } from "@/lib/errors";

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

  if (body.tools.length > 0) {
    const existingTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(inArray(tools.id, body.tools), eq(tools.userId, user.id)));
    if (existingTools.length !== body.tools.length) {
      return badRequest("部分工具不存在或无权访问");
    }
  }

  if (body.knowledgeBaseIds.length > 0) {
    const existingKbs = await db
      .select({ id: knowledgeBases.id })
      .from(knowledgeBases)
      .where(and(inArray(knowledgeBases.id, body.knowledgeBaseIds), eq(knowledgeBases.userId, user.id)));
    if (existingKbs.length !== body.knowledgeBaseIds.length) {
      return badRequest("部分知识库不存在或无权访问");
    }
  }

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
