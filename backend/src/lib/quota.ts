import { getDb } from "@/lib/db";
import { knowledgeBases, knowledgeDocuments } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { config } from "@/lib/config";
import { getCloudflareContext } from "@/lib/env-holder";

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
  const kv = getCloudflareContext().env.QUOTA_KV;

  // 无 KV 绑定（异常环境）时放行，避免阻断主流程
  if (!kv) {
    return { allowed: true, current: 0, limit: plan.dailyRequests };
  }

  // 按天计数真实请求次数：键 = 用户 + 日期，TTL 两天确保跨日安全
  const dayKey = new Date().toISOString().slice(0, 10);
  const kvKey = `quota:${userId}:${dayKey}`;
  const currentRaw = await kv.get(kvKey);
  const current = currentRaw ? parseInt(currentRaw, 10) : 0;

  // KV get-then-put 非原子，高并发下计数可能偏低；
  // 阈值乘 0.9 容差系数，缓解竞态造成的配额绕过（尽力而为）
  const effectiveLimit = Math.max(1, Math.floor(plan.dailyRequests * 0.9));

  if (current >= effectiveLimit) {
    return { allowed: false, current, limit: plan.dailyRequests, reason: `今日已用 ${current}/${plan.dailyRequests} 次` };
  }

  await kv.put(kvKey, String(current + 1), { expirationTtl: 2 * 24 * 3600 });
  return { allowed: true, current: current + 1, limit: plan.dailyRequests, reason: undefined };
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
