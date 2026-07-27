import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents, chats, messages } from "@/lib/db/schema";
import { and, eq, desc, lt } from "drizzle-orm";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export async function GET(
  req: Request,
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

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const before = url.searchParams.get("before");

  const query = db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      before
        ? and(eq(messages.chatId, id), lt(messages.createdAt, new Date(before)))
        : eq(messages.chatId, id)
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const rows = await query;

  const hasMore = rows.length === limit;
  const cursor = hasMore ? rows[rows.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    messages: rows.reverse(),
    cursor,
    hasMore,
  });
}
