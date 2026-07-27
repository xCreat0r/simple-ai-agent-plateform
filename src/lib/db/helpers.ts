import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import type { PgTable, PgColumn, PgInsertValue } from "drizzle-orm/pg-core";
import { notFound } from "@/lib/errors";

type SelectableTable = PgTable & { [key: string]: any };

export async function assertOwnership(
  table: SelectableTable,
  idColumn: PgColumn,
  id: string,
  userIdColumn: PgColumn,
  userId: string
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(idColumn, id), eq(userIdColumn, userId)));

  if (!row) throw notFound("资源不存在");
  return row as Record<string, unknown>;
}

export async function findById(
  table: SelectableTable,
  idColumn: PgColumn,
  id: string
): Promise<Record<string, unknown> | undefined> {
  const [row] = await db.select().from(table).where(eq(idColumn, id));
  return row as Record<string, unknown> | undefined;
}

export async function syncManyToMany(
  table: SelectableTable,
  parentCol: PgColumn,
  parentId: string,
  childCol: PgColumn,
  childIds: string[]
): Promise<void> {
  await db.delete(table).where(eq(parentCol, parentId));
  if (childIds.length > 0) {
    const values: Record<string, unknown>[] = childIds.map((id) => ({
      [parentCol.name]: parentId,
      [childCol.name]: id,
    }));
    await db.insert(table).values(values as PgInsertValue<typeof table>[]);
  }
}
