import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Copy } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatMessagesProps {
  messages: Message[];
  streamingContent?: string;
}

export function ChatMessages({ messages, streamingContent }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !streamingContent && (
        <div className="flex h-full items-center justify-center text-sm text-neutral-400">
          开始对话吧
        </div>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "group relative max-w-[80%] rounded-lg px-4 py-2",
              msg.role === "user"
                ? "bg-neutral-900 text-neutral-50"
                : "bg-neutral-100 text-neutral-900"
            )}
          >
            {msg.role === "assistant" || msg.role === "tool" ? (
              <Markdown content={msg.content} />
            ) : (
              <p className="whitespace-pre-wrap">{msg.content}</p>
            )}
            <button
              onClick={() => handleCopy(msg.content)}
              className="absolute -right-8 top-2 hidden rounded p-1 text-neutral-400 hover:text-neutral-600 group-hover:block"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      {streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg bg-neutral-100 px-4 py-2 text-neutral-900">
            <Markdown content={streamingContent} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
