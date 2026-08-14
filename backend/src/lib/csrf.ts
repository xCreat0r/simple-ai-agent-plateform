import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

// CSRF 防护（Double-submit cookie）：
// 登录/刷新成功后种一个非 HttpOnly 的 csrf_token cookie（前端 JS 可读），
// 前端把该值放入 X-CSRF-Token 请求头回传，后端校验两者一致。
// 仅对 cookie 鉴权的 auth 端点（refresh / sign-out）生效；
// 其余端点使用 Bearer 头鉴权，天然不受 CSRF 影响。

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "X-CSRF-Token";

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// cookie 属性与主 refresh_token cookie 保持一致（sameSite/secure 由调用方传入）
export function setCsrfCookie(c: Context, sameSite: "None" | "Lax", secure: boolean): void {
  setCookie(c, CSRF_COOKIE, generateCsrfToken(), {
    httpOnly: false, // 必须前端可读，才能放进请求头
    path: "/",
    sameSite,
    secure,
    maxAge: 7 * 24 * 60 * 60,
  });
}

// 登出时清除 CSRF cookie
export function clearCsrfCookie(c: Context, sameSite: "None" | "Lax", secure: boolean): void {
  setCookie(c, CSRF_COOKIE, "", {
    httpOnly: false,
    path: "/",
    sameSite,
    secure,
    maxAge: 0,
  });
}

// 校验 Double-submit：请求头中的 token 必须与 cookie 中一致
export function verifyCsrf(c: Context): boolean {
  const cookie = getCookie(c, CSRF_COOKIE);
  if (!cookie || cookie.length === 0) return false;
  const header = c.req.header(CSRF_HEADER);
  return header === cookie;
}
