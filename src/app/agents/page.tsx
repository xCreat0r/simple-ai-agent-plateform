import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { AgentCard } from "@/components/agents/agent-card";
import { Plus, Wrench, Bot, Book } from "lucide-react";

export default async function AgentsPage() {
  const user = getCurrentUser();
  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id))
    .orderBy(desc(agents.updatedAt));

  const agentsWithTools = await Promise.all(
    agentRows.map(async (agent) => {
      const tools = await db
        .select()
        .from(agentTools)
        .where(eq(agentTools.agentId, agent.id));
      return {
        ...agent,
        tools: tools.map((t) => t.toolId),
      };
    })
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium">Agent</h1>
          <Link
            href="/tools"
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <Wrench className="w-3.5 h-3.5" />
            工具
          </Link>
          <Link
            href="/knowledge"
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <Book className="w-3.5 h-3.5" />
            知识库
          </Link>
        </div>
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
