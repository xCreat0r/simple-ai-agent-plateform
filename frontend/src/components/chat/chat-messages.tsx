import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Copy, RefreshCw } from "lucide-react";
import type { Message } from "@/lib/types";

interface ChatMessagesProps {
  messages: Message[];
  streamingContent?: string;
  onRegenerate?: () => void;
  isLoading?: boolean;
}

function ChatMessagesInner({ messages, streamingContent, onRegenerate, isLoading }: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // 仅当接近底部时跟随滚动；流式高频更新用 auto 避免 smooth 卡顿
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: streamingContent ? "auto" : "smooth" });
    }
  }, [messages, streamingContent]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  // 最后一条 assistant 消息的位置，用于展示"重新生成"
  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
  const lastAssistantGlobalIdx = lastAssistantIdx >= 0 ? messages.length - 1 - lastAssistantIdx : -1;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && !streamingContent && (
        <div className="flex h-full items-center justify-center text-sm text-neutral-400">
          开始对话吧
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
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
              aria-label="复制"
              className="absolute -right-8 top-2 hidden rounded p-1 text-neutral-400 hover:text-neutral-600 group-hover:block"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {i === lastAssistantGlobalIdx && onRegenerate && !streamingContent && (
            <button
              onClick={onRegenerate}
              className="ml-2 self-center rounded p-1 text-neutral-400 hover:text-neutral-600"
              aria-label="重新生成"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg bg-neutral-100 px-4 py-2 text-neutral-900">
            <Markdown content={streamingContent} />
          </div>
        </div>
      )}
      {isLoading && !streamingContent && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-4 py-2.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: "300ms" }} />
            <span className="ml-1.5 text-xs text-neutral-400">正在思考…</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export const ChatMessages = memo(ChatMessagesInner);
