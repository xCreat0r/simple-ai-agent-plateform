import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { users, refreshTokens } from "@/lib/db/schema";

// 静态 mock：vi.mock 会提升到 import 之前，auth 路由加载时即拿到 mock
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 }),
}));

import { authRoutes } from "@/routes/auth";
import { getDb } from "@/lib/db";

const mockedGetDb = vi.mocked(getDb);

// 密码明文与 auth.ts 中 DUMMY_HASH 对应：用户存在且密码正确时可登录
const TEST_PASSWORD = "dummy-timing-equalizer-2026";
const DUMMY_HASH = "$2b$10$88AdibxRrer/NqFgHW0/5OQqLj/Z2ql/LYtEufdiwKzPee.kcoenO";

function mockDb(state: { users?: unknown[]; refresh?: unknown[] } = {}): void {
  const s = { users: [...(state.users ?? [])], refresh: [...(state.refresh ?? [])] };
  const whereUsers = vi.fn().mockImplementation(() => Promise.resolve(s.users));
  const whereRefresh = vi.fn().mockImplementation(() => Promise.resolve(s.refresh));
  const from = vi.fn((t: unknown) => (t === users ? { where: whereUsers } : { where: whereRefresh }));
  const select = vi.fn().mockReturnValue({ from });
  // insert 捕获写入：登录/轮换产生的 refresh token 记录进状态，供后续查询
  const insert = vi.fn((t: unknown) => ({
    values: vi.fn((vals: Record<string, unknown>) => {
      if (t === refreshTokens) s.refresh.push(vals);
      return Promise.resolve(undefined);
    }),
  }));
  const del = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockedGetDb.mockReturnValue({ select, insert, delete: del } as never);
}

function buildApp(): Hono {
  return new Hono().route("/", authRoutes);
}

// 解析响应的 set-cookie，返回 { name: fullCookie }
function parseSetCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of res.headers.getSetCookie()) {
    const name = c.split("=")[0];
    out[name] = c;
  }
  return out;
}

describe("auth 安全行为（防枚举 + CSRF）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("登录用户不存在时返回统一文案，不区分用户是否存在", async () => {
    mockDb();
    const app = buildApp();
    const res = await app.request("/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrongpass123" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("邮箱或密码错误");
  });

  it("登录成功返回 accessToken 并下发非 HttpOnly 的 csrf_token", async () => {
    mockDb({ users: [{ id: "u1", name: "A", passwordHash: DUMMY_HASH }] });
    const app = buildApp();

    const res = await app.request("/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken?: string };
    expect(body.accessToken).toBeTruthy();

    const csrf = parseSetCookies(res).csrf_token;
    expect(csrf).toBeTruthy();
    expect(csrf.includes("HttpOnly")).toBe(false);
  });

  it("refresh 缺少 CSRF 头时返回 403", async () => {
    mockDb();
    const app = buildApp();
    const res = await app.request("/refresh", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("refresh 携带正确 CSRF 头 + cookie 时成功轮换", async () => {
    mockDb({ users: [{ id: "u1", name: "A", passwordHash: DUMMY_HASH }] });
    const app = buildApp();

    const login = await app.request("/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: TEST_PASSWORD }),
    });
    expect(login.status).toBe(200);
    const cookies = parseSetCookies(login);
    const csrfToken = cookies.csrf_token.match(/csrf_token=([^;]+)/)?.[1] || "";
    const cookieHeader = `${cookies.refresh_token.split(";")[0]}; ${cookies.csrf_token.split(";")[0]}`;

    const refresh = await app.request("/refresh", {
      method: "POST",
      headers: { Cookie: cookieHeader, "X-CSRF-Token": csrfToken },
    });
    expect(refresh.status).toBe(200);
    const refreshBody = (await refresh.json()) as { accessToken?: string };
    expect(refreshBody.accessToken).toBeTruthy();
  });

  it("sign-out 缺少 CSRF 头时返回 403", async () => {
    mockDb();
    const app = buildApp();
    const res = await app.request("/sign-out", { method: "POST" });
    expect(res.status).toBe(403);
  });
});
