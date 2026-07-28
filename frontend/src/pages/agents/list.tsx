import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Bot, Plus } from "lucide-react";

export function AgentsList() {
  const navigate = useNavigate();
  const { data: agents, isLoading } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
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
            <Card key={agent.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/agents/${agent.id}`)}>
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
    </div>
  );
}
