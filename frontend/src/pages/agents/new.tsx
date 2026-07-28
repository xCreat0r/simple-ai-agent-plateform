import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Agent } from "@/lib/types";

const modelOptions = [
  { value: "deepseek-chat", label: "DeepSeek Chat" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
];

export function AgentForm({ initialData, onSuccess }: { initialData?: Partial<Agent>; onSuccess: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(initialData?.name || "");
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt || "");
  const [model, setModel] = useState(initialData?.model || "deepseek-chat");
  const [temperature, setTemperature] = useState(initialData?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(initialData?.maxTokens ?? 2048);
  const [selectedTools, setSelectedTools] = useState<string[]>(initialData?.tools || []);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>(initialData?.knowledgeBaseIds || []);

  const { data: tools } = useQuery({ queryKey: ["tools"], queryFn: api.getTools });
  const { data: knowledge } = useQuery({ queryKey: ["knowledge"], queryFn: api.getKnowledge });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; tools: string[]; knowledgeBaseIds: string[] }) =>
      api.createAgent({ ...data, systemPrompt, model, temperature, maxTokens }),
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Agent>) => api.updateAgent(initialData!.id!, data),
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData?.id) {
      updateMutation.mutate({ name, systemPrompt, model, temperature, maxTokens, tools: selectedTools, knowledgeBaseIds: selectedKnowledge });
    } else {
      createMutation.mutate({ name, tools: selectedTools, knowledgeBaseIds: selectedKnowledge });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) => prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]);
  };

  const toggleKnowledge = (kbId: string) => {
    setSelectedKnowledge((prev) => prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? "编辑 Agent" : "新建 Agent"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent 名称" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">系统提示词</Label>
            <Textarea id="systemPrompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="系统提示词" rows={5} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">模型</Label>
            <Select value={model} onValueChange={setModel} items={modelOptions} />
          </div>

          <div className="space-y-2">
            <Label>温度 ({temperature})</Label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-neutral-900"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">最大 Token</Label>
            <Input id="maxTokens" type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} min={1} max={32000} />
          </div>

          <div className="space-y-2">
            <Label>工具</Label>
            {!tools || tools.length === 0 ? (
              <p className="text-sm text-neutral-400">暂无可用工具</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => toggleTool(tool.id)}
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${selectedTools.includes(tool.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:bg-neutral-50"}`}
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>知识库</Label>
            {!knowledge || knowledge.length === 0 ? (
              <p className="text-sm text-neutral-400">暂无可用知识库</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {knowledge.map((kb) => (
                  <button
                    key={kb.id}
                    type="button"
                    onClick={() => toggleKnowledge(kb.id)}
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${selectedKnowledge.includes(kb.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:bg-neutral-50"}`}
                  >
                    {kb.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !name}>
          {isSubmitting ? "保存中..." : initialData ? "保存更改" : "创建"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/agents")}>取消</Button>
      </div>
    </form>
  );
}

export function AgentNew() {
  const navigate = useNavigate();
  return <AgentForm onSuccess={() => navigate("/agents")} />;
}
