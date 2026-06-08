import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { parseBody } from "@/lib/validate";

const createSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const user = await getCurrentUser();
  const rows = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, user.id))
    .orderBy(desc(knowledgeBases.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = parseBody(await req.json(), createSchema);
  const [kb] = await db
    .insert(knowledgeBases)
    .values({ userId: user.id, name: body.name })
    .returning();
  return NextResponse.json(kb, { status: 201 });
}
