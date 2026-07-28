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
  const windowKey = Math.floor(now / windowMs);
  const kvKey = `ratelimit:${key}:${windowKey}`;

  const current = await env.RATE_LIMIT_KV.get(kvKey);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxRequests) {
    const resetAt = (windowKey + 1) * windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), {
    expirationTtl: Math.ceil(windowMs / 1000),
  });

  const resetAt = (windowKey + 1) * windowMs;
  return { allowed: true, remaining: maxRequests - count - 1, resetAt };
}
