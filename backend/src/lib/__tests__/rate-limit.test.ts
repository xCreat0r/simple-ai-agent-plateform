import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env-holder", () => ({
  getCloudflareContext: vi.fn(),
}));

import { getCloudflareContext } from "@/lib/env-holder";
import { checkRateLimit } from "@/lib/rate-limit";

const mockedCtx = vi.mocked(getCloudflareContext);

// 内存 KV 模拟：按 key 存取，可断言 get/put 调用
function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  };
}

function mockEnv(kv: ReturnType<typeof fakeKv>) {
  mockedCtx.mockReturnValue({ env: { RATE_LIMIT_KV: kv } } as never);
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("达到有效阈值（含 0.9 容差）前放行，之后拒绝", async () => {
    mockEnv(fakeKv());
    const max = 10; // effectiveMax = floor(10 * 0.9) = 9

    for (let i = 0; i < 9; i++) {
      const r = await checkRateLimit("key", max, 60_000);
      expect(r.allowed).toBe(true);
    }
    const denied = await checkRateLimit("key", max, 60_000);
    expect(denied.allowed).toBe(false);
    expect(denied.resetAt).toBeGreaterThan(Date.now());
  });

  it("同一窗口内不同 key 独立计数", async () => {
    mockEnv(fakeKv());
    await checkRateLimit("a", 10, 60_000);
    await checkRateLimit("a", 10, 60_000);
    const b = await checkRateLimit("b", 10, 60_000);
    expect(b.allowed).toBe(true);
  });

  it("窗口结束后计数清零（新窗口键）", async () => {
    vi.useFakeTimers();
    try {
      const kv = fakeKv();
      mockEnv(kv);
      const windowMs = 1000;
      const t0 = 1_000_000_000_000;
      vi.setSystemTime(t0);

      // 第一个窗口打满后拒绝
      for (let i = 0; i < 9; i++) await checkRateLimit("key", 10, windowMs);
      expect((await checkRateLimit("key", 10, windowMs)).allowed).toBe(false);

      // 进入下一个窗口：应重新放行
      vi.setSystemTime(t0 + windowMs);
      expect((await checkRateLimit("key", 10, windowMs)).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
