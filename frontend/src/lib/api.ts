import { fetchWithAuth, refreshAccessToken, setAccessToken } from "./fetch-with-auth";

// 统一 JSON 请求：复用 fetchWithAuth（含 401 刷新重试）
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "请求失败");
  }
  return res.json();
}

export const api = {
  // Auth
  signUp: (body: { email: string; password: string; name: string }) =>
    request<{ user: { id: string; name: string | null }; accessToken: string }>("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify(body) })
      .then((data) => {
        setAccessToken(data.accessToken);
        return data;
      }),
  signIn: (body: { email: string; password: string }) =>
    request<{ user: { id: string; name: string | null }; accessToken: string }>("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify(body) })
      .then((data) => {
        setAccessToken(data.accessToken);
        return data;
      }),
  signOut: async () => {
    try {
      await request<{ ok: boolean }>("/api/auth/sign-out", { method: "POST" });
    } finally {
      setAccessToken(null);
    }
  },
  refresh: () => refreshAccessToken(),
  // 公开配置（无需登录）：注册开关等
  getAuthConfig: () => request<{ allowSignup: boolean }>("/api/auth/config"),

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
  uploadDocument: async (kbId: string, file: File) => {
    // 文件上传：FormData，复用 fetchWithAuth（含 401 刷新）
    const form = new FormData();
    form.append("file", file);
    const res = await fetchWithAuth(`/api/knowledge/${kbId}/documents`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "上传失败");
    return data as { id: string; filename: string; chunkCount: number; status: string };
  },
  deleteDocument: (kbId: string, docId: string) =>
    request<{ ok: boolean }>(`/api/knowledge/${kbId}/documents/${docId}`, { method: "DELETE" }),
};
