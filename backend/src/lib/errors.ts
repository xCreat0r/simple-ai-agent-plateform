export function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json" } });
}

export function unauthorized(msg = "未登录") {
  return new Response(JSON.stringify({ error: msg }), { status: 401, headers: { "Content-Type": "application/json" } });
}

export function notFound(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 404, headers: { "Content-Type": "application/json" } });
}

export function tooManyRequests(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 429, headers: { "Content-Type": "application/json" } });
}

export function internalError(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
}
