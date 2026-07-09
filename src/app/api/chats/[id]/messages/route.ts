import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, chats, messages } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();

  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(agents, eq(chats.agentId, agents.id))
    .where(and(eq(chats.id, id), eq(agents.userId, user.id)))
    .limit(1);

  if (!chat) return notFound("Not found");

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(asc(messages.createdAt));

  return NextResponse.json(rows);
}
