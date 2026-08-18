import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("新对话"),
  // 用户是否手动改过名：为 true 时自动生成标题不再覆盖
  titleEdited: boolean("title_edited").notNull().default(false),
  createdAt: timestamp("created_at").notNull(),
});
