import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

export function useChat(agentId: string, chatId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentId, chatId, content }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error("请求失败");
      if (!response.body) throw new Error("没有响应体");

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
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Stream error:", err);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [agentId, chatId]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setMessages((prev) => prev.filter((m) => m.id !== messages[messages.length - 1]?.id || m.role !== "assistant"));
    await sendMessage(lastUserMsg.content);
  }, [messages, sendMessage]);

  return { messages, streamingContent, sendMessage, stopGeneration, isLoading, regenerate };
}
