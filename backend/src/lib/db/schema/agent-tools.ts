import { pgTable, text, primaryKey, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const agentTools = pgTable(
  "agent_tools",
  {
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    toolId: text("tool_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.toolId] }),
  ]
);
