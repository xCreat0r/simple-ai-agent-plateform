import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const tools = pgTable("tools", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  parameters: jsonb("parameters").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull().default("POST"),
  headers: jsonb("headers"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
