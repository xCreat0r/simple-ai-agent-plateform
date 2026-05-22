import { AgentForm } from "@/components/agents/agent-form";

export default function NewAgentPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-medium mb-6">新建 Agent</h1>
      <AgentForm />
    </div>
  );
}
