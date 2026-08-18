import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Bot, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function AgentsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { data: agents, isLoading, isError, refetch } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-neutral-500">
        <span>加载失败</span>
        <Button variant="outline" onClick={() => refetch()}>重试</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Agent</h1>
        <Button onClick={() => navigate("/agents/new")}>
          <Plus className="mr-1 h-4 w-4" />新建 Agent
        </Button>
      </div>

      {!agents || agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-12 w-12" />}
          title="还没有 Agent"
          description="创建第一个 Agent 来开始对话"
          action={<Button onClick={() => navigate("/agents/new")}><Plus className="mr-1 h-4 w-4" />新建 Agent</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="group relative cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/agents/${agent.id}`)}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`删除 ${agent.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ id: agent.id, name: agent.name });
                }}
              >
                <Trash2 className="h-4 w-4 text-neutral-400 hover:text-red-600" />
              </Button>
              <CardHeader>
                <CardTitle>{agent.name}</CardTitle>
                <CardDescription>模型: {agent.model}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Badge variant="secondary">{agent.tools?.length || 0} 工具</Badge>
                <Badge variant="secondary">{agent.knowledgeBaseIds?.length || 0} 知识库</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="删除 Agent"
        description={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？其下的所有对话也将一并删除，此操作不可撤销。` : ""}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
