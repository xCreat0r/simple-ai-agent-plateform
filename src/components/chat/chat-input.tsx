"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  loading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatInput({ loading, onSend, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSend() {
    const text = value.trim();
    if (!text) return;
    setValue("");
    onSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          className="min-h-10 max-h-40 resize-none"
        />
        {loading ? (
          <Button size="icon" variant="outline" onClick={onStop} className="shrink-0">
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={handleSend} disabled={!value.trim()} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
