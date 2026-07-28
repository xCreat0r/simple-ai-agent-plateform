const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "请求失败");
  }
  return res.json();
}

export const api = {
  // Auth
  signUp: (body: { email: string; password: string; name: string }) =>
    request("/api/auth/sign-up/email", { method: "POST", body: JSON.stringify(body) }),
  signIn: (body: { email: string; password: string }) =>
    request("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify(body) }),
  signOut: () => request("/api/auth/sign-out", { method: "POST" }),
  getSession: () => request<{ user?: { id: string; name: string | null }; session?: unknown }>("/api/auth/session"),

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
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API}/api/knowledge/${kbId}/documents`, {
      method: "POST", credentials: "include", body: form,
    }).then((r) => r.json());
  },
  deleteDocument: (kbId: string, docId: string) =>
    request<{ ok: boolean }>(`/api/knowledge/${kbId}/documents/${docId}`, { method: "DELETE" }),
};
