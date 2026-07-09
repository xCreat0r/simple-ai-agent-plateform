import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { createToolSchema } from "@/lib/validators";
import { parseBody } from "@/lib/validate";

export async function GET() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(tools)
    .where(eq(tools.userId, user.id))
    .orderBy(desc(tools.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = parseBody(await req.json(), createToolSchema);

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
