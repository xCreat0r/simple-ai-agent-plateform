import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, chats } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { badRequest, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { createChatSchema } from "@/lib/validators";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");

  if (!agentId) return badRequest("agentId required");

  const user = await requireUser();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)));
  if (!agent) return notFound("Agent not found");

  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.agentId, agentId))
    .orderBy(desc(chats.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = parseBody(await req.json(), createChatSchema);
  const user = await requireUser();

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, body.agentId), eq(agents.userId, user.id)));
  if (!agent) return notFound("Agent not found");

  const [chat] = await db
    .insert(chats)
    .values({ agentId: body.agentId, title: body.title || "新对话" })
    .returning();

  return NextResponse.json(chat, { status: 201 });
}
