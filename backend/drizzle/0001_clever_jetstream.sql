-- 0001: 主键/外键列 text → uuid 对齐 + chats.title_edited 新增列
-- 幂等版本：可安全重复执行，不因"已执行过/部分执行"报错
-- text → uuid 必须带 USING 子句（Postgres 不允许隐式转换）
-- 先删除外键约束 → 转换列类型 → 新增列 → 重建外键

-- 1. 删除外键约束（12 条，IF EXISTS 幂等）
ALTER TABLE "agent_knowledge" DROP CONSTRAINT IF EXISTS "agent_knowledge_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agent_knowledge" DROP CONSTRAINT IF EXISTS "agent_knowledge_kb_id_knowledge_bases_id_fk";--> statement-breakpoint
ALTER TABLE "agent_tools" DROP CONSTRAINT IF EXISTS "agent_tools_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "chats" DROP CONSTRAINT IF EXISTS "chats_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_bases" DROP CONSTRAINT IF EXISTS "knowledge_bases_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT IF EXISTS "knowledge_chunks_doc_id_knowledge_documents_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_chunks" DROP CONSTRAINT IF EXISTS "knowledge_chunks_kb_id_knowledge_bases_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_documents" DROP CONSTRAINT IF EXISTS "knowledge_documents_kb_id_knowledge_bases_id_fk";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_chat_id_chats_id_fk";--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "tools" DROP CONSTRAINT IF EXISTS "tools_user_id_users_id_fk";--> statement-breakpoint

-- 2. 转换列类型 text → uuid（19 列，带 USING；对已是 uuid 的列幂等）
ALTER TABLE "agent_knowledge" ALTER COLUMN "agent_id" SET DATA TYPE uuid USING "agent_id"::uuid;--> statement-breakpoint
ALTER TABLE "agent_knowledge" ALTER COLUMN "kb_id" SET DATA TYPE uuid USING "kb_id"::uuid;--> statement-breakpoint
ALTER TABLE "agent_tools" ALTER COLUMN "agent_id" SET DATA TYPE uuid USING "agent_id"::uuid;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "agent_id" SET DATA TYPE uuid USING "agent_id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ALTER COLUMN "kb_id" SET DATA TYPE uuid USING "kb_id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ALTER COLUMN "doc_id" SET DATA TYPE uuid USING "doc_id"::uuid;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ALTER COLUMN "kb_id" SET DATA TYPE uuid USING "kb_id"::uuid;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "chat_id" SET DATA TYPE uuid USING "chat_id"::uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "tools" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "tools" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint

-- 3. chats 新增 title_edited 列（IF NOT EXISTS 幂等）
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "title_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- 4. 重建外键约束（12 条，IF NOT EXISTS 幂等）
ALTER TABLE "agent_knowledge" ADD CONSTRAINT "agent_knowledge_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_knowledge" ADD CONSTRAINT "agent_knowledge_kb_id_knowledge_bases_id_fk" FOREIGN KEY ("kb_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_doc_id_knowledge_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_kb_id_knowledge_bases_id_fk" FOREIGN KEY ("kb_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_kb_id_knowledge_bases_id_fk" FOREIGN KEY ("kb_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
