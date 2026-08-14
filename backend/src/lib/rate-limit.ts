import { getCloudflareContext } from "@/lib/env-holder";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const { env } = getCloudflareContext();
  const now = Date.now();
  // 固定时间窗口限流：窗口键 = 当前时间 / 窗口长度 取整，
  // 同一窗口内计数，超过阈值则拒绝
  const windowKey = Math.floor(now / windowMs);
  const kvKey = `ratelimit:${key}:${windowKey}`;

  const current = await env.RATE_LIMIT_KV.get(kvKey);
  const count = current ? parseInt(current, 10) : 0;

  // KV get-then-put 非原子，高并发下计数可能偏低；
  // 阈值乘 0.9 容差系数，缓解竞态造成的限流绕过（尽力而为）
  const effectiveMax = Math.max(1, Math.floor(maxRequests * 0.9));

  if (count >= effectiveMax) {
    // 超限：计算窗口结束时间供客户端知道何时重试
    const resetAt = (windowKey + 1) * windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  // KV 写入带 TTL 自动过期，窗口结束后计数自动清空
  await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), {
    expirationTtl: Math.ceil(windowMs / 1000),
  });

  const resetAt = (windowKey + 1) * windowMs;
  return { allowed: true, remaining: effectiveMax - count - 1, resetAt };
}
