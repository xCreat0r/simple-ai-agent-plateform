import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { agents, chats } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, badRequest } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { parseBody } from "@/lib/validate";

const updateChatSchema = z.object({
  title: z.string().min(1).max(100),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireUser();
  const body = parseBody(await req.json(), updateChatSchema);

  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(agents, eq(chats.agentId, agents.id))
    .where(and(eq(chats.id, id), eq(agents.userId, user.id)))
    .limit(1);

  if (!chat) return notFound("Not found");

  await db
    .update(chats)
    .set({ title: body.title })
    .where(eq(chats.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  await db.delete(chats).where(eq(chats.id, id));
  return NextResponse.json({ ok: true });
}
