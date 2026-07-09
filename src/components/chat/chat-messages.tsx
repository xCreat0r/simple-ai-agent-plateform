"use client";

import { useRef, useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Markdown } from "./markdown";

interface Message {
  id: string;
  role: string;
  content: string;
}

export function ChatMessages({ messages, loading }: { messages: Message[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => setCopiedId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  function handleCopy(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        发送一条消息开始对话
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((m) => {
        const isUser = m.role === "user";
        const isTool = m.role === "tool";

        return (
          <div
            key={m.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed group relative ${
                isUser
                  ? "bg-white border border-gray-200 text-gray-900"
                  : isTool
                    ? "bg-amber-50 border border-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-900"
              }`}
            >
              {isUser ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : (
                <Markdown content={m.content} />
              )}
              {!isUser && !isTool && m.content && (
                <button
                  onClick={() => handleCopy(m.id, m.content)}
                  className="absolute -top-2 -right-2 p-1 rounded bg-white border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="复制"
                >
                  {copiedId === m.id ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {loading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-lg px-4 py-2">
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
