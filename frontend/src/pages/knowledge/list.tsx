import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Library, Plus } from "lucide-react";

export function KnowledgeList() {
  const navigate = useNavigate();
  const { data: knowledge, isLoading } = useQuery({ queryKey: ["knowledge"], queryFn: api.getKnowledge });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
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
              <CardHeader>
                <CardTitle>{kb.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-500">创建于 {new Date(kb.createdAt).toLocaleDateString("zh-CN")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
