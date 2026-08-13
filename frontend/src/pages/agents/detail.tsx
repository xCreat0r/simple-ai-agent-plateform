import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Chat } from "@/lib/types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { useChat } from "@/hooks/useChat";
import { MessageSquare, Plus, Trash2, Settings, MessageCircle } from "lucide-react";

export function AgentDetail() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);

  const { data: agent } = useQuery({ queryKey: ["agent", agentId], queryFn: () => api.getAgent(agentId!), enabled: !!agentId });
  const { data: chats, isError: chatsError } = useQuery({ queryKey: ["chats", agentId], queryFn: () => api.getChats(agentId!), enabled: !!agentId });

  const { messages, streamingContent, sendMessage, stopGeneration, isLoading, regenerate } = useChat(agentId!, activeChatId);

  // 流式结束后刷新对话列表，让异步生成的标题及时显示
  useEffect(() => {
    if (!isLoading) {
      queryClient.invalidateQueries({ queryKey: ["chats", agentId] });
    }
  }, [isLoading, agentId, queryClient]);

  const createChatMutation = useMutation({
    mutationFn: () => api.createChat({ agentId: agentId! }),
    onSuccess: (chat: Chat) => {
      setActiveChatId(chat.id);
      queryClient.invalidateQueries({ queryKey: ["chats", agentId] });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => api.deleteChat(chatId),
    onSuccess: () => {
      if (deleteChatId === activeChatId) setActiveChatId(undefined);
      setDeleteChatId(null);
      queryClient.invalidateQueries({ queryKey: ["chats", agentId] });
    },
  });

  useEffect(() => {
    if (chats && chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  return (
    <div className="flex h-full gap-0 -m-6">
      <div className="flex w-72 shrink-0 flex-col border-r border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 p-3">
          <span className="truncate text-sm font-semibold">{agent?.name || "加载中..."}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/agents/${agentId}/edit`)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chatsError ? (
            <div className="py-8 text-center text-sm text-neutral-400">加载失败</div>
          ) : !chats || chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-neutral-400 gap-2">
              <MessageCircle className="h-8 w-8" />
              <span>暂无对话</span>
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat: Chat) => (
                <div
                  key={chat.id}
                  className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${activeChatId === chat.id ? "bg-neutral-200 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <span className="truncate">{chat.title || "新对话"}</span>
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteChatId(chat.id); }}
                    className="hidden shrink-0 text-neutral-400 hover:text-red-600 group-hover:block focus-visible:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-3">
          <Button className="w-full" size="sm" onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending}>
            <Plus className="mr-1 h-4 w-4" />新建对话
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {!activeChatId ? (
          <EmptyState
            icon={<MessageSquare className="h-12 w-12" />}
            title="选择或创建对话"
            description="从左侧选择一个对话，或创建新的对话开始"
            action={<Button onClick={() => createChatMutation.mutate()} disabled={createChatMutation.isPending}><Plus className="mr-1 h-4 w-4" />新建对话</Button>}
          />
        ) : (
          <>
            <ChatMessages messages={messages} streamingContent={streamingContent} onRegenerate={regenerate} />
            <ChatInput key={activeChatId} onSend={sendMessage} onStop={stopGeneration} loading={isLoading} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteChatId}
        onOpenChange={() => setDeleteChatId(null)}
        title="删除对话"
        description="确定要删除此对话吗？此操作不可撤销。"
        onConfirm={() => deleteChatId && deleteChatMutation.mutate(deleteChatId)}
        loading={deleteChatMutation.isPending}
      />
    </div>
  );
}
