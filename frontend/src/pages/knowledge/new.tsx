import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KnowledgeNew() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (name: string) => api.createKnowledgeBase(name),
    onSuccess: () => navigate("/knowledge"),
    onError: (err) => setError(err instanceof Error ? err.message : "创建失败"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(name);
  };

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>新建知识库</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="知识库名称" required />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={mutation.isPending || !name.trim()}>
                {mutation.isPending ? "创建中..." : "创建"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/knowledge")}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
