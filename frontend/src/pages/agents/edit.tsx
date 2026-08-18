import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AgentForm } from "./new";

export function AgentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: agent, isLoading } = useQuery({ queryKey: ["agent", id], queryFn: () => api.getAgent(id!), enabled: !!id });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
  if (!agent) return <div className="text-neutral-500">Agent 不存在</div>;

  return (
    <AgentForm
      initialData={agent}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        navigate(`/agents/${id}`);
      }}
    />
  );
}
