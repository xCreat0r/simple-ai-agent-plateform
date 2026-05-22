"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ChatItem {
  id: string;
  title: string;
  createdAt: string;
}

interface MessageItem {
  id: string;
  role: string;
  content: string;
}

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: agentId } = use(params);
  const [agentName, setAgentName] = useState("");
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then((r) => r.json())
      .then((d) => setAgentName(d.name));
    loadChats();
  }, [agentId]);

  async function loadChats() {
    const res = await fetch(`/api/chats?agentId=${agentId}`);
    const data = await res.json();
    setChats(data);
    if (data.length > 0) {
      selectChat(data[0].id);
    }
  }

  async function selectChat(id: string) {
    setChatId(id);
    chatIdRef.current = id;
    const res = await fetch(`/api/chats/${id}/messages`);
    const data = await res.json();
    setMessages(data);
  }

  async function newChat() {
    setChatId(null);
    chatIdRef.current = null;
    setMessages([]);
  }

  async function handleSend(text: string) {
    if (loading || !text.trim()) return;

    setLoading(true);
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          chatId: chatIdRef.current,
          content: text,
        }),
        signal: controller.signal,
      });

      const newChatId = res.headers.get("x-chat-id");
      if (newChatId && !chatIdRef.current) {
        chatIdRef.current = newChatId;
        setChatId(newChatId);
        loadChats();
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      const assistantId = Date.now().toString() + "-a";
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="h-screen flex">
      <aside className="w-56 border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200">
          <Link
            href={`/agents/${agentId}/edit`}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {agentName || "Agent"}
          </Link>
        </div>
        <div className="p-2 flex-1 overflow-y-auto">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-1.5 text-sm px-2 py-1.5 rounded hover:bg-gray-100 text-gray-600"
          >
            <Plus className="w-3.5 h-3.5" />
            新对话
          </button>
          <div className="mt-2 space-y-0.5">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => selectChat(c.id)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded truncate ${
                  chatId === c.id
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-gray-200">
          <Link href="/agents" className="text-sm text-gray-400 hover:text-gray-600">
            ← 返回列表
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <ChatMessages messages={messages} loading={loading} />
        <ChatInput loading={loading} onSend={handleSend} onStop={handleStop} />
      </main>
    </div>
  );
}
