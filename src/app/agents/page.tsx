import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { AgentCard } from "@/components/agents/agent-card";
import { Plus, Wrench } from "lucide-react";

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
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">还没有 Agent</p>
          <Link
            href="/agents/new"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            创建第一个
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
