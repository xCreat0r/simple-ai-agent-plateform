const API = import.meta.env.VITE_API_URL;

// 内存中保存 access token；refreshPromise 用于并发去重，避免多个请求同时刷新
let accessToken: string | null = null;
let refreshPromise: Promise<{ user: { id: string; name: string | null }; accessToken: string } | null> | null = null;

export function getAccessToken() {
  return accessToken;
}

// 通过 HttpOnly cookie 中的 refresh token 换取新的 access token
async function doRefresh() {
  // 若已有刷新请求进行中，直接复用同一 Promise
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
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

// 统一请求封装：自动附带 Bearer token，401 时先刷新再重试一次
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const buildFetch = (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API}${path}`, {
      ...opts,
      credentials: "include",
      headers: { ...headers, ...(opts?.headers as Record<string, string>) },
    });
  };

  let res = await buildFetch();
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    // access token 过期：刷新后重试原请求
    const refreshed = await doRefresh();
    if (refreshed) res = await buildFetch();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "请求失败");
  }
  return res.json();
}

export const api = {
  // Auth
  signUp: (body: { email: string; password: string; name: string }) =>
    request<{ user: { id: string; name: string | null }; accessToken: string }>("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify(body) }),
  signIn: (body: { email: string; password: string }) =>
    request<{ user: { id: string; name: string | null }; accessToken: string }>("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify(body) }),
  signOut: () => request<{ ok: boolean }>("/api/auth/sign-out", { method: "POST" }),
  refresh: (): Promise<{ user: { id: string; name: string | null }; accessToken: string } | null> => doRefresh(),
  getSession: () => request<{ user?: { id: string; name: string | null } | null }>("/api/auth/session"),

  // Agents
  getAgents: () => request<import("./types").Agent[]>("/api/agents"),
  getAgent: (id: string) => request<import("./types").Agent>(`/api/agents/${id}`),
  createAgent: (body: Partial<import("./types").Agent> & { name: string; tools: string[]; knowledgeBaseIds: string[] }) =>
    request<import("./types").Agent>("/api/agents", { method: "POST", body: JSON.stringify(body) }),
  updateAgent: (id: string, body: Partial<import("./types").Agent>) =>
    request<import("./types").Agent>(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAgent: (id: string) => request<{ ok: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),

  // Chats
  getChats: (agentId: string) => request<import("./types").Chat[]>(`/api/chats?agentId=${agentId}`),
  createChat: (body: { agentId: string; title?: string }) =>
    request<import("./types").Chat>("/api/chats", { method: "POST", body: JSON.stringify(body) }),
  updateChat: (id: string, title: string) =>
    request<{ ok: boolean }>(`/api/chats/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteChat: (id: string) => request<{ ok: boolean }>(`/api/chats/${id}`, { method: "DELETE" }),
  getMessages: (chatId: string, before?: string) =>
    request<{ messages: import("./types").Message[]; cursor: string | null; hasMore: boolean }>(
      `/api/chats/${chatId}/messages${before ? `?before=${before}` : ""}`
    ),

  // Tools
  getTools: () => request<import("./types").Tool[]>("/api/tools"),
  getTool: (id: string) => request<import("./types").Tool>(`/api/tools/${id}`),
  createTool: (body: Partial<import("./types").Tool>) =>
    request<import("./types").Tool>("/api/tools", { method: "POST", body: JSON.stringify(body) }),
  updateTool: (id: string, body: Partial<import("./types").Tool>) =>
    request<import("./types").Tool>(`/api/tools/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTool: (id: string) => request<{ ok: boolean }>(`/api/tools/${id}`, { method: "DELETE" }),

  // Knowledge
  getKnowledge: () => request<import("./types").KnowledgeBase[]>("/api/knowledge"),
  getKnowledgeBase: (id: string) => request<import("./types").KnowledgeBase>(`/api/knowledge/${id}`),
  createKnowledgeBase: (name: string) =>
    request<import("./types").KnowledgeBase>("/api/knowledge", { method: "POST", body: JSON.stringify({ name }) }),
  deleteKnowledgeBase: (id: string) => request<{ ok: boolean }>(`/api/knowledge/${id}`, { method: "DELETE" }),
  getDocuments: (kbId: string) => request<import("./types").Document[]>(`/api/knowledge/${kbId}/documents`),
  uploadDocument: (kbId: string, file: File) => {
    // 文件上传需要 FormData，不使用 JSON 封装，单独处理
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return fetch(`${API}/api/knowledge/${kbId}/documents`, {
      method: "POST", credentials: "include", body: form, headers,
    }).then((r) =>
      r.json().then((data) => {
        if (!r.ok) throw new Error(data.error || "上传失败");
        return data as { id: string; filename: string; chunkCount: number; status: string };
      })
    );
  },
  deleteDocument: (kbId: string, docId: string) =>
    request<{ ok: boolean }>(`/api/knowledge/${kbId}/documents/${docId}`, { method: "DELETE" }),
};
