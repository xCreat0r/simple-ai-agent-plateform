import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Wrench, Plus, Trash2 } from "lucide-react";

export function ToolsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { data: tools, isLoading, isError, refetch } = useQuery({ queryKey: ["tools"], queryFn: api.getTools });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTool(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["tools"] });
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

  const builtinTools = tools?.filter((t) => t.builtin) || [];
  const customTools = tools?.filter((t) => !t.builtin) || [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">工具</h1>
        <Button onClick={() => navigate("/tools/new")}>
          <Plus className="mr-1 h-4 w-4" />新建工具
        </Button>
      </div>

      {(!tools || tools.length === 0) ? (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="还没有工具"
          description="创建自定义工具或使用内置工具"
          action={<Button onClick={() => navigate("/tools/new")}><Plus className="mr-1 h-4 w-4" />新建工具</Button>}
        />
      ) : (
        <div className="space-y-8">
          {builtinTools.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-neutral-500">内置工具</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {builtinTools.map((tool) => (
                  <Card key={tool.id}>
                    <CardHeader>
                      <CardTitle>{tool.name}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary">内置</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {customTools.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-neutral-500">自定义工具</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {customTools.map((tool) => (
                  <Card key={tool.id} className="group relative cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/tools/${tool.id}/edit`)}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`删除 ${tool.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: tool.id, name: tool.name });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-neutral-400 hover:text-red-600" />
                    </Button>
                    <CardHeader>
                      <CardTitle>{tool.name}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      {tool.method && <Badge>{tool.method}</Badge>}
                      {tool.endpoint && <Badge variant="outline">{tool.endpoint}</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="删除工具"
        description={deleteTarget ? `确定要删除「${deleteTarget.name}」吗？使用该工具的 Agent 将不再能调用它。` : ""}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
