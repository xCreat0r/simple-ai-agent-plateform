// 统一请求封装：token 管理 + 401 自动刷新重试。
// JSON 请求与 SSE 流式请求共用，避免两套 401 逻辑分叉。

// 生产环境前端与 /api 同源（Pages Functions 代理到后端 Worker），VITE_API_URL 留空走相对路径；
// 本地开发直连本机后端（如 http://localhost:8787）
const API = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

// 内存中保存 access token；refreshPromise 用于并发去重，避免多个请求同时刷新
let accessToken: string | null = null;
let refreshPromise: Promise<{ user: { id: string; name: string | null }; accessToken: string } | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// 读取 Double-submit 的 csrf_token cookie（非 HttpOnly，前端可读），
// 供 cookie 鉴权的 auth 端点（refresh/sign-out）附加到请求头防 CSRF
function getCsrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

// 需要 CSRF 防护的端点（后端 verifyCsrf 只对它们生效）
function needsCsrf(path: string): boolean {
  return path.startsWith("/api/auth/refresh") || path.startsWith("/api/auth/sign-out");
}

// 通过 HttpOnly cookie 中的 refresh token 换取新的 access token
async function doRefresh(): Promise<{ user: { id: string; name: string | null }; accessToken: string } | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": getCsrfToken() },
      });
      if (!res.ok) return null;
      const data = await res.json();
      accessToken = data.accessToken;
      return data;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export function refreshAccessToken() {
  return doRefresh();
}

interface FetchWithAuthOptions {
  allowRefresh?: boolean;
}

// 统一请求：附带 Bearer token + credentials，401 时刷新重试一次。
// body 为 FormData 时不强制 Content-Type（浏览器自动带 boundary）。
export async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
  opts: FetchWithAuthOptions = {}
): Promise<Response> {
  const { allowRefresh = true } = opts;

  const build = (): Promise<Response> => {
    const headers = new Headers(init.headers);
    const isFormData = init.body instanceof FormData;
    if (!isFormData && init.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const token = accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (needsCsrf(path)) headers.set("X-CSRF-Token", getCsrfToken());
    return fetch(`${API}${path}`, { ...init, headers, credentials: "include" });
  };

  let res = await build();
  if (res.status === 401 && allowRefresh && !path.startsWith("/api/auth/")) {
    const refreshed = await doRefresh();
    if (refreshed) res = await build();
  }
  return res;
}
