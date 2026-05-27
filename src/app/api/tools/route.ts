import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createToolSchema } from "@/lib/validators";

export async function GET() {
  const user = getCurrentUser();
  const rows = await db
    .select()
    .from(tools)
    .where(eq(tools.userId, user.id))
    .orderBy(desc(tools.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = getCurrentUser();
  const body = createToolSchema.parse(await req.json());

  const [tool] = await db
    .insert(tools)
    .values({
      userId: user.id,
      name: body.name,
      description: body.description,
      parameters: body.parameters,
      endpoint: body.endpoint,
      method: body.method,
      headers: body.headers ?? null,
    })
    .returning();

  return NextResponse.json(tool, { status: 201 });
}
