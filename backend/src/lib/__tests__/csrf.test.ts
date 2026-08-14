import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { setCsrfCookie, verifyCsrf } from "@/lib/csrf";

// 用 Hono 最小 app 模拟路由上下文，验证 Double-submit cookie 的读写与校验
function buildApp() {
  const app = new Hono();
  app.get("/set", (c) => {
    setCsrfCookie(c, "Lax", false);
    return c.text("ok");
  });
  app.get("/verify", (c) => {
    return c.json({ ok: verifyCsrf(c) });
  });
  return app;
}

describe("csrf Double-submit", () => {
  it("setCsrfCookie 下发非 HttpOnly 的 csrf_token cookie", async () => {
    const app = buildApp();
    const res = await app.request("/set");
    const cookie = res.headers.get("set-cookie") || "";
    expect(cookie).toMatch(/^csrf_token=[0-9a-f]+/);
    expect(cookie.includes("HttpOnly")).toBe(false); // 前端需可读
    expect(cookie).toContain("Path=/");
  });

  it("请求头与 cookie 一致时校验通过", async () => {
    const app = buildApp();
    const res = await app.request("/set");
    const cookie = res.headers.get("set-cookie") || "";
    const token = cookie.match(/csrf_token=([^;]+)/)?.[1] || "";

    const ok = await app.request("/verify", {
      headers: { Cookie: cookie.split(";")[0], "X-CSRF-Token": token },
    });
    expect(await ok.json()).toEqual({ ok: true });
  });

  it("请求头与 cookie 不一致时校验失败", async () => {
    const app = buildApp();
    const res = await app.request("/set");
    const cookie = res.headers.get("set-cookie") || "";

    const bad = await app.request("/verify", {
      headers: { Cookie: cookie.split(";")[0], "X-CSRF-Token": "deadbeef" },
    });
    expect(await bad.json()).toEqual({ ok: false });
  });

  it("缺少请求头时校验失败", async () => {
    const app = buildApp();
    const res = await app.request("/set");
    const cookie = res.headers.get("set-cookie") || "";

    const bad = await app.request("/verify", {
      headers: { Cookie: cookie.split(";")[0] },
    });
    expect(await bad.json()).toEqual({ ok: false });
  });
});
