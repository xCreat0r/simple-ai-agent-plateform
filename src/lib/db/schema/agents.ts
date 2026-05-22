import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull().default(""),
  model: text("model").notNull().default("deepseek-chat"),
  temperature: numeric("temperature").notNull().default("0.7"),
  maxTokens: integer("max_tokens").notNull().default(4096),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
