import { getDb } from "@/lib/db";
import { chats, knowledgeBases, knowledgeDocuments } from "@/lib/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";
import { config } from "@/lib/config";

export interface Plan {
  name: string;
  dailyRequests: number;
  knowledgeStorageMB: number;
  maxAgents: number;
  maxTools: number;
}

const plans: Record<string, Plan> = {
  // 目前仅实现 free 套餐，配额数值来自全局配置
  free: {
    name: "free",
    dailyRequests: config.quota.freeDailyRequests,
    knowledgeStorageMB: config.quota.freeKnowledgeStorageMB,
    maxAgents: config.quota.freeMaxAgents,
    maxTools: config.quota.freeMaxTools,
  },
};

export function getPlan(_userId: string): Plan {
  return plans.free;
}

export async function checkQuota(userId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const plan = getPlan(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 统计该用户今天创建的对话数（通过 agents 表关联，保证只统计自己的数据）
  const [result] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(chats)
    .innerJoin(
      sql`(SELECT id FROM agents WHERE agents.user_id = ${userId}) AS user_agents`,
      sql`chats.agent_id = user_agents.id`
    )
    .where(gte(chats.createdAt, today));

  const current = Number(result?.count ?? 0);
  const allowed = current < plan.dailyRequests;

  return { allowed, current, limit: plan.dailyRequests, reason: allowed ? undefined : `今日已用 ${current}/${plan.dailyRequests} 次` };
}

export async function checkKnowledgeStorage(userId: string, additionalBytes = 0): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const plan = getPlan(userId);
  // 汇总该用户所有知识库文档的字节数，判断是否达到存储上限
  const [result] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${knowledgeDocuments.sizeBytes}), 0)` })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.kbId, knowledgeBases.id))
    .where(eq(knowledgeBases.userId, userId));

  const current = Number(result?.total ?? 0);
  const limit = plan.knowledgeStorageMB * 1024 * 1024;
  const allowed = current + additionalBytes <= limit;

  return {
    allowed,
    current,
    limit,
    reason: allowed ? undefined : `知识库存储已满（已用 ${(current / 1024 / 1024).toFixed(1)}MB，上限 ${plan.knowledgeStorageMB}MB）`,
  };
}
