import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "@/lib/config";

const client = postgres(process.env.DATABASE_URL!, {
  max: config.db.poolMax,
  idle_timeout: config.db.idleTimeoutMs / 1000,
  connect_timeout: 30,
  prepare: false,
});

export const db = drizzle(client, { schema });

export async function closeDb() {
  await client.end();
}

