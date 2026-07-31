import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("新对话"),
  createdAt: timestamp("created_at").notNull(),
});
