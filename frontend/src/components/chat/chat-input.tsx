import { useState, useRef, type KeyboardEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  loading: boolean;
}

export function ChatInput({ onSend, onStop, loading }: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文等输入法组合态下 Enter 用于选词，不应触发发送
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-neutral-200 bg-white p-4">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        className="min-h-[40px] max-h-[200px] resize-none"
        rows={1}
        disabled={loading}
      />
      {loading ? (
        <Button onClick={onStop} variant="secondary" size="icon" className="shrink-0">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={handleSend} size="icon" className="shrink-0" disabled={!content.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
