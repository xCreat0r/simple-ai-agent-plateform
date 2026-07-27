import Link from "next/link";
import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/agents" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Agent 列表
      </Link>
      <h1 className="text-lg font-medium mb-6">新建 Agent</h1>
      <AgentForm />
    </div>
  );
}
