import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Chat } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { useChat } from "@/hooks/useChat";
import { MessageSquare, Plus, Trash2, Settings, MessageCircle, Pencil, ArrowLeft } from "lucide-react";

export function AgentDetail() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const [showDeleteAgent, setShowDeleteAgent] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // 记录已提交改名的会话，防止 Enter 与失焦重复提交
  const renameSubmittedRef = useRef<Record<string, boolean>>({});
  // 标题刷新轮询：记录 isLoading 上一状态与已轮询次数
  const prevLoadingRef = useRef(false);
  const pollCountRef = useRef(0);

  const { data: agent } = useQuery({ queryKey: ["agent", agentId], queryFn: () => api.getAgent(agentId!), enabled: !!agentId });
  const { data: chats, isError: chatsError } = useQuery({ queryKey: ["chats", agentId], queryFn: () => api.getChats(agentId!), enabled: !!agentId });

  const { messages, streamingContent, sendMessage, stopGeneration, isLoading, regenerate } = useChat(agentId!, activeChatId);

  // 流式结束后轮询刷新对话列表：后端异步生成标题时序不可控，
  // 用 isLoading 下降沿触发，每 1.5s 刷新一次，最多 3 次（约 4.5s 窗口）
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    if (wasLoading && !isLoading) {
      pollCountRef.current = 0;
      const timer = setInterval(() => {
        pollCountRef.current += 1;
        queryClient.invalidateQueries({ queryKey: ["chats", agentId] });
        if (pollCountRef.current >= 3) clearInterval(timer);
      }, 1500);
      return () => clearInterval(timer);
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

  const deleteAgentMutation = useMutation({
    mutationFn: () => api.deleteAgent(agentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate("/agents");
    },
  });

  const renameChatMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.updateChat(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", agentId] });
    },
    onSettled: (_data, _error, { id }) => {
      delete renameSubmittedRef.current[id];
    },
  });

  // 进入编辑态
  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setDraftTitle(chat.title || "");
  };

  // 提交改名：空标题/未变更不提交，Enter 与失焦共用，防止重复提交
  const commitRename = (chat: Chat) => {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === chat.title || renameSubmittedRef.current[chat.id]) {
      setEditingChatId(null);
      return;
    }
    renameSubmittedRef.current[chat.id] = true;
    setEditingChatId(null);
    renameChatMutation.mutate({ id: chat.id, title: trimmed });
  };

  // 取消编辑
  const cancelRename = () => setEditingChatId(null);

  useEffect(() => {
    if (chats && chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  return (
    <div className="flex h-full gap-0 -m-6">
      <div className="flex w-72 shrink-0 flex-col border-r border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/agents")} aria-label="返回 Agent 列表">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="truncate text-sm font-semibold">{agent?.name || "加载中..."}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/agents/${agentId}/edit`)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowDeleteAgent(true)}>
              <Trash2 className="h-4 w-4 text-neutral-400 hover:text-red-600" />
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
                  {editingChatId === chat.id ? (
                    <Input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitRename(chat)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(chat);
                        else if (e.key === "Escape") cancelRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 px-2 py-1"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{chat.title || "新对话"}</span>
                  )}
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                      className="hidden rounded p-1 text-neutral-400 hover:text-neutral-700 group-hover:block focus-visible:block"
                      aria-label="重命名"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); setDeleteChatId(chat.id); }}
                      className="hidden shrink-0 text-neutral-400 hover:text-red-600 group-hover:block focus-visible:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
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
            <ChatMessages messages={messages} streamingContent={streamingContent} onRegenerate={regenerate} isLoading={isLoading} />
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

      <ConfirmDialog
        open={showDeleteAgent}
        onOpenChange={() => setShowDeleteAgent(false)}
        title="删除 Agent"
        description={`确定要删除「${agent?.name || ""}」吗？其下的所有对话也将一并删除，此操作不可撤销。`}
        onConfirm={() => deleteAgentMutation.mutate()}
        loading={deleteAgentMutation.isPending}
      />
    </div>
  );
}
