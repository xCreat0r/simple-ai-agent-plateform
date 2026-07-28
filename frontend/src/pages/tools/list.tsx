import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Wrench, Plus } from "lucide-react";

export function ToolsList() {
  const navigate = useNavigate();
  const { data: tools, isLoading } = useQuery({ queryKey: ["tools"], queryFn: api.getTools });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
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
                  <Card key={tool.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/tools/${tool.id}/edit`)}>
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
    </div>
  );
}
