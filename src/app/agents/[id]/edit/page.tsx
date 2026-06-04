import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { agents, agentTools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AgentForm } from "@/components/agents/agent-form";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) notFound();

  const tools = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, id));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/agents/${id}`} className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Agent 详情
      </Link>
      <h1 className="text-lg font-medium mb-6">编辑 Agent</h1>
      <AgentForm
        agent={{
          ...agent,
          tools: tools.map((t) => t.toolId),
        }}
      />
    </div>
  );
}
