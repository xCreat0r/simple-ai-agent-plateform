import { and, eq } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { notFound } from "@/lib/errors";
import { getDb } from "./index";

export async function assertOwnership(
  table: PgTable,
  idColumn: PgColumn,
  id: string,
  userIdColumn: PgColumn,
  userId: string
): Promise<Record<string, unknown>> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(idColumn, id), eq(userIdColumn, userId)));

  if (!row) throw notFound("资源不存在");
  return row as Record<string, unknown>;
}

export async function findById(
  table: PgTable,
  idColumn: PgColumn,
  id: string
): Promise<Record<string, unknown> | undefined> {
  const db = getDb();
  const [row] = await db.select().from(table).where(eq(idColumn, id));
  return row as Record<string, unknown> | undefined;
}

export async function syncManyToMany(
  table: PgTable,
  parentCol: PgColumn,
  parentId: string,
  childCol: PgColumn,
  childIds: string[]
): Promise<void> {
  const db = getDb();
  await db.delete(table).where(eq(parentCol, parentId));
  if (childIds.length > 0) {
    const values: Record<string, unknown>[] = childIds.map((id) => ({
      [parentCol.name]: parentId,
      [childCol.name]: id,
    }));
    await db.insert(table).values(values as any);
  }
}
