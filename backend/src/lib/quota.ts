import { getDb } from "@/lib/db";
import { chats } from "@/lib/db/schema";
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

  const [result] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(chats)
    .innerJoin(
      sql`(SELECT id FROM agents WHERE agents.user_id = ${userId}) AS user_agents`,
      sql`chats.agent_id = user_agents.id`
    )
    .where(gte(chats.createdAt, today));

  const current = result?.count ?? 0;
  const allowed = current < plan.dailyRequests;

  return { allowed, current, limit: plan.dailyRequests, reason: allowed ? undefined : `今日已用 ${current}/${plan.dailyRequests} 次` };
}
