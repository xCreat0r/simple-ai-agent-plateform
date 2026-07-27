"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Eye, EyeOff } from "lucide-react";
import type { ToolData } from "@/lib/types";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "token",
  "secret",
  "api-token",
  "access-token",
  "bearer",
]);

function isSensitive(key: string): boolean {
  return SENSITIVE_HEADERS.has(key.toLowerCase());
}

interface ParamRow {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface HeaderRow {
  key: string;
  value: string;
  masked: boolean;
  originalValue: string;
}

export function ToolForm({ tool }: { tool?: ToolData }) {
  const router = useRouter();
  const isEditing = !!tool;
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [endpoint, setEndpoint] = useState(tool?.endpoint ?? "");
  const [method, setMethod] = useState(tool?.method ?? "POST");
  const [params, setParams] = useState<ParamRow[]>([]);
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tool?.parameters?.properties) {
      const rows: ParamRow[] = Object.entries(tool.parameters.properties).map(
        ([name, def]) => ({
          name,
          type: def.type as "string" | "number" | "boolean",
          description: def.description ?? "",
          required: tool.parameters.required.includes(name),
        })
      );
      setParams(rows);
    }
    if (tool?.headers) {
      const h = tool.headers as Record<string, string>;
      setHeaders(
        Object.entries(h).map(([key, value]) => ({
          key,
          value: isSensitive(key) ? "" : value,
          masked: isSensitive(key),
          originalValue: isSensitive(key) ? value : "",
        }))
      );
    }
  }, [tool]);

  function addParam() {
    setParams([...params, { name: "", type: "string", description: "", required: false }]);
  }

  function removeParam(index: number) {
    setParams(params.filter((_, i) => i !== index));
  }

  function updateParam(index: number, field: keyof ParamRow, value: string | boolean) {
    setParams(params.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addHeader() {
    setHeaders([...headers, { key: "", value: "", masked: false, originalValue: "" }]);
  }

  function removeHeader(index: number) {
    setHeaders(headers.filter((_, i) => i !== index));
  }

  function updateHeader(index: number, field: keyof HeaderRow, value: string | boolean) {
    setHeaders(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  }

  function toggleMask(index: number) {
    setHeaders(
      headers.map((h, i) => {
        if (i !== index) return h;
        if (h.masked) {
          return { ...h, masked: false, value: h.originalValue };
        } else {
          return { ...h, masked: true, originalValue: h.value, value: "" };
        }
      })
    );
  }

  function buildSchema() {
    const properties: Record<string, { type: string; description: string }> = {};
    const required: string[] = [];
    for (const p of params) {
      if (!p.name) continue;
      properties[p.name] = { type: p.type, description: p.description };
      if (p.required) required.push(p.name);
    }
    return { type: "object" as const, properties, required };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const headerObj: Record<string, string> = {};
    for (const h of headers) {
      if (h.key) headerObj[h.key] = h.masked ? h.originalValue : h.value;
    }

    const body: Record<string, unknown> = {
      name,
      description,
      parameters: buildSchema(),
      endpoint,
      method,
    };
    if (isEditing) {
      body.headers = Object.keys(headerObj).length > 0 ? headerObj : null;
    } else if (Object.keys(headerObj).length > 0) {
      body.headers = headerObj;
    }

    const url = isEditing ? `/api/tools/${tool!.id}` : "/api/tools";
    const httpMethod = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method: httpMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/tools");
      router.refresh();
    } else {
      setError("保存失败，请重试");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">名称</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="查天气" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">描述</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="根据城市名查询天气" rows={3} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="endpoint">端点 URL</Label>
          <Input id="endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://my-api.com/weather" required />
        </div>
        <div className="space-y-2">
          <Label>方法</Label>
          <Select value={method} onValueChange={(v) => setMethod(v ?? "POST")}>
            <SelectTrigger>
              <SelectValue placeholder="POST" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Headers</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addHeader}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            添加
          </Button>
        </div>
        {headers.length === 0 && (
          <p className="text-sm text-gray-400">无需 Header（如 Authorization）</p>
        )}
        {headers.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Key"
              value={h.key}
              onChange={(e) => updateHeader(i, "key", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <div className="flex-1 relative">
              <Input
                placeholder={isSensitive(h.key) ? "已设置（重新输入将覆盖）" : "Value"}
                value={h.masked ? "" : h.value}
                type={h.masked ? "password" : "text"}
                onChange={(e) => {
                  updateHeader(i, "value", e.target.value);
                  if (h.masked && e.target.value) {
                    updateHeader(i, "masked", false);
                  }
                }}
                className="h-8 text-sm pr-8"
              />
              {isSensitive(h.key) && (
                <button
                  type="button"
                  onClick={() => toggleMask(i)}
                  className="absolute inset-y-0 right-0 px-2 text-gray-400 hover:text-gray-600"
                >
                  {h.masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <button type="button" onClick={() => removeHeader(i)} className="text-gray-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>参数</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addParam}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            添加
          </Button>
        </div>

        {params.length === 0 && (
          <p className="text-sm text-gray-400">无需参数</p>
        )}

        {params.map((p, i) => (
          <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
            <Input
              placeholder="参数名"
              value={p.name}
              onChange={(e) => updateParam(i, "name", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Select value={p.type} onValueChange={(v) => updateParam(i, "type", v ?? "string")}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="number">number</SelectItem>
                <SelectItem value="boolean">boolean</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="描述"
              value={p.description}
              onChange={(e) => updateParam(i, "description", e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <div className="flex items-center gap-1">
              <Checkbox
                checked={p.required}
                onCheckedChange={(v) => updateParam(i, "required", !!v)}
              />
              <span className="text-xs text-gray-400">必填</span>
            </div>
            <button type="button" onClick={() => removeParam(i)} className="text-gray-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中..." : isEditing ? "更新" : "创建"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
