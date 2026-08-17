import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Library, Plus, Trash2 } from "lucide-react";

export function KnowledgeList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteKbId, setDeleteKbId] = useState<string | null>(null);
  const { data: knowledge, isLoading, isError, refetch } = useQuery({ queryKey: ["knowledge"], queryFn: api.getKnowledge });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteKnowledgeBase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setDeleteKbId(null);
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
        <h1 className="text-2xl font-bold text-neutral-900">知识库</h1>
        <Button onClick={() => navigate("/knowledge/new")}>
          <Plus className="mr-1 h-4 w-4" />新建知识库
        </Button>
      </div>

      {!knowledge || knowledge.length === 0 ? (
        <EmptyState
          icon={<Library className="h-12 w-12" />}
          title="还没有知识库"
          description="创建知识库来管理文档"
          action={<Button onClick={() => navigate("/knowledge/new")}><Plus className="mr-1 h-4 w-4" />新建知识库</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knowledge.map((kb) => (
            <Card key={kb.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/knowledge/${kb.id}`)}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle>{kb.name}</CardTitle>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteKbId(kb.id); }}
                  className="shrink-0 text-neutral-400 hover:text-red-600 transition-colors"
                  aria-label={`删除 ${kb.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-500">创建于 {new Date(kb.createdAt).toLocaleDateString("zh-CN")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteKbId}
        onOpenChange={() => setDeleteKbId(null)}
        title="删除知识库"
        description="确定要删除此知识库吗？该知识库及其所有文档将被删除，此操作不可撤销。"
        onConfirm={() => deleteKbId && deleteMutation.mutate(deleteKbId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
