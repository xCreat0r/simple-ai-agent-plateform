import { useState, useRef, useCallback, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

export function useChat(agentId: string, chatId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // 记录当前会话 id，流式期间据此判断会话是否已切换，避免跨会话污染
  const chatIdRef = useRef<string | undefined>(chatId);

  // 切换会话时重新加载历史消息；cleanup 中止旧流并丢弃过期响应
  useEffect(() => {
    chatIdRef.current = chatId;
    let cancelled = false;
    abortRef.current?.abort();
    abortRef.current = null;

    if (!chatId) {
      setMessages([]);
      setStreamingContent("");
      return;
    }
    setIsLoading(false);
    setStreamingContent("");
    api.getMessages(chatId)
      .then((res: { messages: Message[] }) => {
        if (!cancelled) setMessages(res.messages);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const sendMessage = useCallback(async (content: string, opts?: { regenerate?: boolean }) => {
    if (!chatId || !content.trim()) return;
    const sendingChatId = chatId;

    // regenerate 模式下用户消息已在历史中，不再重复追加
    if (!opts?.regenerate) {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        chatId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    setIsLoading(true);
    setStreamingContent("");

    // 保存 AbortController 用于"停止生成"
    const abortController = new AbortController();
    abortRef.current = abortController;
    let streamText = "";

    try {
      const response = await fetchWithAuth("/api/chat", {
        method: "POST",
        body: JSON.stringify({ agentId, chatId, content, regenerate: opts?.regenerate ?? false }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "请求失败");
      }
      if (!response.body) throw new Error("没有响应体");

      // 逐块读取 SSE 流，实时更新"生成中"文本
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        // 会话已切换：中止本次流式更新，避免消息追加到新会话
        if (chatIdRef.current !== sendingChatId) {
          abortController.abort();
          break;
        }
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const text = decoder.decode(value, { stream: true });
          streamText += text;
          setStreamingContent(streamText);
        }
      }

      if (chatIdRef.current !== sendingChatId) return;

      // 后端错误以 [error]...[/error] 标记注入流，解析后作为独立错误消息展示
      const errorMatch = streamText.match(/\[error\]([\s\S]*?)\[\/error\]/);
      if (errorMatch) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            chatId,
            role: "assistant",
            content: `⚠️ ${errorMatch[1].trim()}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreamingContent("");
        return;
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
      if (chatIdRef.current !== sendingChatId) return;
      // 用户主动停止生成时静默退出
      if (err instanceof Error && err.name === "AbortError") return;
      // 后端错误以 [error] 标记注入流（controller.error 前已 enqueue），优先解析该标记
      const errorMatch = streamText.match(/\[error\]([\s\S]*?)\[\/error\]/);
      const message = errorMatch ? errorMatch[1].trim() : (err instanceof Error ? err.message : "发送失败");
      // 错误展示为独立 assistant 消息，保留用户消息
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          content: `⚠️ ${message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingContent("");
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

  // 重新生成：找到最后一条用户消息，删除其后所有消息后重发（后端 regenerate 模式）
  const regenerate = useCallback(() => {
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx < 0) return;
    const idx = messages.length - 1 - lastUserIdx;
    const lastUserMsg = messages[idx];
    setMessages((prev) => prev.slice(0, idx + 1));
    sendMessage(lastUserMsg.content, { regenerate: true });
  }, [messages, sendMessage]);

  return { messages, streamingContent, sendMessage, stopGeneration, isLoading, regenerate };
}
