"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Agent } from "@/lib/types";
import { getToolName } from "@/lib/tools";

export function AgentCard({ agent }: { agent: Agent & { tools?: string[] } }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    setShowConfirm(false);
    await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
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
            {agent.tools?.map((toolId) => (
              <Badge key={toolId} variant="secondary" className="text-xs">
                {getToolName(toolId)}
              </Badge>
            ))}
            <div className="flex-1" />
            <Link
              href={`/agents/${agent.id}/edit`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              编辑
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)} className="text-red-600 hover:text-red-700">
              删除
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirm}
        title="删除 Agent"
        description={`确定要删除「${agent.name}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
