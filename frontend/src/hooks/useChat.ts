import { useState, useRef, useCallback, useEffect } from "react";
import { api, getAccessToken } from "@/lib/api";
import type { Message } from "@/lib/types";

const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

// 构造带认证头的流式请求；401 时刷新 token 重试一次
async function fetchWithAuth(path: string, init: RequestInit): Promise<Response> {
  const build = (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  };

  let res = await build();
  if (res.status === 401) {
    const refreshed = await api.refresh();
    if (refreshed) res = await build();
  }
  return res;
}

export function useChat(agentId: string, chatId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 切换会话时重新加载历史消息
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setStreamingContent("");
      return;
    }
    setIsLoading(false);
    setStreamingContent("");
    api.getMessages(chatId).then((res: { messages: Message[] }) => {
      setMessages(res.messages);
    }).catch(() => {
      setMessages([]);
    });
  }, [chatId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!chatId || !content.trim()) return;

    // 先本地渲染用户消息，再发起流式请求
    const userMsg: Message = {
      id: crypto.randomUUID(),
      chatId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent("");

    // 保存 AbortController 用于"停止生成"
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetchWithAuth("/api/chat", {
        method: "POST",
        body: JSON.stringify({ agentId, chatId, content }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        // 读取后端错误信息（如对话不存在/配额不足），展示给用户
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "请求失败");
      }
      if (!response.body) throw new Error("没有响应体");

      // 逐块读取 SSE 流，实时更新"生成中"文本
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let streamText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          streamText += text;
          setStreamingContent(streamText);
        }
      }

      // 流结束后把完整回复作为正式消息加入列表
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        chatId,
        role: "assistant",
        content: streamText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
    } catch (err) {
      // 用户主动停止生成时静默退出，不做错误提示
      if (err instanceof DOMException && err.name === "AbortError") return;
      // 展示错误信息（如对话不存在），并移除本地预渲染的用户消息
      const message = err instanceof Error ? err.message : "发送失败";
      setStreamingContent(`\n\n⚠️ ${message}\n\n`);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      console.error("Stream error:", err);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [agentId, chatId]);

  // 停止生成：中止底层 fetch 流
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(async () => {
    // 重新生成：找到最后一条用户消息，移除末尾 assistant 回复后重发
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setMessages((prev) => prev.filter((m) => m.id !== messages[messages.length - 1]?.id || m.role !== "assistant"));
    await sendMessage(lastUserMsg.content);
  }, [messages, sendMessage]);

  return { messages, streamingContent, sendMessage, stopGeneration, isLoading, regenerate };
}
