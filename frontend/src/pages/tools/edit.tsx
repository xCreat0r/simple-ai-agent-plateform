import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ToolForm } from "./new";

export function ToolEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tool, isLoading } = useQuery({ queryKey: ["tool", id], queryFn: () => api.getTool(id!), enabled: !!id });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>;
  if (!tool) return <div className="text-neutral-500">工具不存在</div>;

  return <ToolForm initialData={tool} onSuccess={() => navigate("/tools")} />;
}
