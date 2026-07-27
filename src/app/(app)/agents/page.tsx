import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc, inArray } from "drizzle-orm";
import { AgentCard } from "@/components/agents/agent-card";
import { Plus, Bot } from "lucide-react";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id))
    .orderBy(desc(agents.updatedAt));

  const agentIds = agentRows.map((a) => a.id);
  const toolRows =
    agentIds.length > 0
      ? await db
          .select()
          .from(agentTools)
          .where(inArray(agentTools.agentId, agentIds))
      : [];

  const toolsByAgentId = new Map<string, string[]>();
  for (const row of toolRows) {
    const list = toolsByAgentId.get(row.agentId) || [];
    list.push(row.toolId);
    toolsByAgentId.set(row.agentId, list);
  }

  const agentsWithTools = agentRows.map((agent) => ({
    ...agent,
    tools: toolsByAgentId.get(agent.id) || [],
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium">Agent</h1>
        <Link
          href="/agents/new"
          className={buttonVariants({ size: "sm" })}
        >
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Link>
      </div>

      {agentsWithTools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <Bot className="w-12 h-12 text-gray-300 mb-4" />
          <p className="text-sm text-gray-500 mb-1">还没有 Agent</p>
          <p className="text-xs text-gray-400 mb-4 max-w-xs">
            创建第一个 Agent，配置系统提示词和工具，然后与它对话
          </p>
          <Link
            href="/agents/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="w-4 h-4 mr-1" />
            新建 Agent
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {agentsWithTools.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
