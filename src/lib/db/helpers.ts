import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export async function findById(
  table: Parameters<typeof db.select>[0] extends (...args: infer P) => any ? P[0] : never,
  idColumn: PgColumn,
  id: string
): Promise<Record<string, unknown> | undefined> {
  const [row] = await db.select().from(table as never).where(eq(idColumn, id));
  return row as Record<string, unknown> | undefined;
}

export async function syncManyToMany(
  table: Parameters<typeof db.delete>[0] extends (...args: infer P) => any ? P[0] : never,
  parentCol: PgColumn,
  parentId: string,
  childCol: PgColumn,
  childIds: string[]
): Promise<void> {
  await db.delete(table as never).where(eq(parentCol, parentId));
  if (childIds.length > 0) {
    await db.insert(table as never).values(
      childIds.map((id) => ({
        [parentCol.name]: parentId,
        [childCol.name]: id,
      }) as Record<string, unknown>) as never
    );
  }
}
