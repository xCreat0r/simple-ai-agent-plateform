import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.agentId, agentId))
    .orderBy(desc(chats.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { agentId, title } = await req.json();

  const [chat] = await db
    .insert(chats)
    .values({ agentId, title: title || "新对话" })
    .returning();

  return NextResponse.json(chat, { status: 201 });
}
