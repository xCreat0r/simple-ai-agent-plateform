import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { agents } from "./agents";

export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  kbId: uuid("kb_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  docId: uuid("doc_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  kbId: uuid("kb_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentKnowledge = pgTable("agent_knowledge", {
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  kbId: uuid("kb_id")
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: "cascade" }),
});
