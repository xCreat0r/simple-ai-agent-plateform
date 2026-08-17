// Pages Functions 同源代理：将前端同源的 /api/* 请求转发到后端 Worker。
// 前端与 API 同源后，refresh_token / csrf_token cookie 都落在页面域下，
// SameSite=Lax 与 Double-submit CSRF 按原设计正常工作，无需跨站 cookie。

interface ProxyContext {
  request: Request;
  env: { API_ORIGIN?: string };
}

export const onRequest = async (context: ProxyContext) => {
  const base = context.env.API_ORIGIN ?? "";
  if (!base) {
    return new Response("API_ORIGIN 环境变量未配置（Pages 项目 Settings → Environment variables）", {
      status: 500,
    });
  }

  const url = new URL(context.request.url);
  const target = new URL(url.pathname + url.search, base.replace(/\/+$/, ""));

  return fetch(target, context.request);
};