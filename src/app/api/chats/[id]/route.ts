import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(chats).where(eq(chats.id, id));
  return NextResponse.json({ ok: true });
}
