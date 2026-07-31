import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { chats } from "./chats";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  toolCalls: jsonb("tool_calls"),
  toolResult: jsonb("tool_result"),
  createdAt: timestamp("created_at").notNull(),
});
