import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { chats } from "./chats";

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  toolCalls: jsonb("tool_calls"),
  toolResult: jsonb("tool_result"),
  createdAt: timestamp("created_at").notNull(),
});
