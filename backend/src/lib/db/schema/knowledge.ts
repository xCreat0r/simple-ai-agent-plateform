import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector";
import { users } from "./users";
import { agents } from "./agents";

export const knowledgeBases = pgTable("knowledge_bases", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: text("id").primaryKey(),
  kbId: text("kb_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: text("id").primaryKey(),
  docId: text("doc_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  kbId: text("kb_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  createdAt: timestamp("created_at").notNull(),
});

export const agentKnowledge = pgTable(
  "agent_knowledge",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    kbId: text("kb_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.kbId] }),
  })
);
