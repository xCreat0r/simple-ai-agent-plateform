import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

const createToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.object({
      type: z.enum(["string", "number", "boolean"]),
      description: z.string().default(""),
    })),
    required: z.array(z.string()).default([]),
  }),
  endpoint: z.string().url(),
  method: z.enum(["GET", "POST"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
});

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
