import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Agent } from "@/lib/types";
import { getAllTools } from "@/lib/tools";

export function AgentCard({ agent, onDelete }: { agent: Agent & { tools?: string[] }; onDelete?: () => void }) {
  const toolList = getAllTools();

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          <Link href={`/agents/${agent.id}`} className="hover:text-blue-600">
            {agent.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {agent.systemPrompt || "无系统提示词"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {agent.tools?.map((toolId) => {
            const tool = toolList.find((t) => t.id === toolId);
            return tool ? (
              <Badge key={toolId} variant="secondary" className="text-xs">
                {tool.name}
              </Badge>
            ) : null;
          })}
          <div className="flex-1" />
          <Link
            href={`/agents/${agent.id}/edit`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            编辑
          </Link>
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              删除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
