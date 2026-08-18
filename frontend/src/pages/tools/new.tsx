import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tool } from "@/lib/types";

const methodOptions = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
];

// 严格解析 JSON；非法时抛错，避免静默以空数据提交
function parseJSON(str: string, label: string): Record<string, unknown> {
  try {
    const v = JSON.parse(str);
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new Error(`${label} 不是合法的 JSON 对象`);
  }
}

function parseHeaders(str: string): Record<string, string> {
  const obj = parseJSON(str, "自定义请求头");
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = String(v);
  }
  return result;
}

function ToolForm({ initialData, onSuccess }: { initialData?: Partial<Tool>; onSuccess: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [endpoint, setEndpoint] = useState(initialData?.endpoint || "");
  const [method, setMethod] = useState(initialData?.method || "GET");
  const [headers, setHeaders] = useState(initialData?.headers ? JSON.stringify(initialData.headers, null, 2) : "{}");
  const [parameters, setParameters] = useState(initialData?.parameters ? JSON.stringify(initialData.parameters, null, 2) : "{}");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string; endpoint: string; method: string; headers: Record<string, string>; parameters: Record<string, unknown> }) =>
      api.createTool(body),
    onSuccess,
    onError: (err) => setError(err instanceof Error ? err.message : "保存失败"),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { name: string; description: string; endpoint: string; method: string; headers: Record<string, string>; parameters: Record<string, unknown> }) =>
      api.updateTool(initialData!.id!, body),
    onSuccess,
    onError: (err) => setError(err instanceof Error ? err.message : "保存失败"),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 先校验 JSON，非法则不提交
    let parsedHeaders: Record<string, string>;
    let parsedParameters: Record<string, unknown>;
    try {
      parsedHeaders = parseHeaders(headers);
      parsedParameters = parseJSON(parameters, "参数 JSON Schema");
    } catch (err) {
      setError(err instanceof Error ? err.message : "JSON 格式错误");
      return;
    }
    const body = { name, description, endpoint, method, headers: parsedHeaders, parameters: parsedParameters };
    if (initialData?.id) updateMutation.mutate(body);
    else createMutation.mutate(body);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? "编辑工具" : "新建工具"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名称" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="工具描述" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">端点 URL</Label>
            <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://api.example.com/endpoint" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">HTTP 方法</Label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
            >
              {methodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headers">自定义请求头 (JSON)</Label>
            <Textarea id="headers" value={headers} onChange={(e) => setHeaders(e.target.value)} rows={4} className="font-mono text-xs" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parameters">参数 JSON Schema (JSON)</Label>
            <Textarea id="parameters" value={parameters} onChange={(e) => setParameters(e.target.value)} rows={6} className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !name}>
          {isSubmitting ? "保存中..." : initialData ? "保存更改" : "创建"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/tools")}>取消</Button>
      </div>
    </form>
  );
}

export function ToolNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return <ToolForm onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["tools"] }); navigate("/tools"); }} />;
}

export { ToolForm };
