import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileText, Upload, Trash2 } from "lucide-react";

export function KnowledgeDetail() {
  const { id: kbId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: kb } = useQuery({
    queryKey: ["knowledge", kbId],
    queryFn: () => api.getKnowledgeBase(kbId!),
    enabled: !!kbId,
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", kbId],
    queryFn: () => api.getDocuments(kbId!),
    enabled: !!kbId,
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "processing") ? 2000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.deleteDocument(kbId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", kbId] });
      setDeleteDocId(null);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(kbId!, file);
      queryClient.invalidateQueries({ queryKey: ["documents", kbId] });
    } catch (err) {
      console.error("Upload failed:", err);
      alert(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusBadge = (doc: { status?: string; chunkCount: number; error?: string }) => {
    if (doc.status === "processing") {
      return <Badge variant="outline">嵌入中...</Badge>;
    }
    if (doc.status === "failed") {
      return <Badge variant="destructive" title={doc.error || "嵌入失败"}>嵌入失败</Badge>;
    }
    return <Badge variant="secondary">{doc.chunkCount} 分块</Badge>;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{kb?.name || "知识库"}</h1>
          <p className="text-sm text-neutral-500">管理知识库文档</p>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt,.md,.json,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1 h-4 w-4" />{uploading ? "上传中..." : "上传文件"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="还没有文档"
          description="上传 PDF、TXT、Markdown、JSON 或 CSV 文件"
          action={
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1 h-4 w-4" />上传文件
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-neutral-400" />
                  <div>
                    <CardTitle className="text-base">{doc.filename}</CardTitle>
                    <CardDescription>
                      上传于 {new Date(doc.createdAt).toLocaleString("zh-CN")}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(doc)}
                  <button
                    onClick={() => setDeleteDocId(doc.id)}
                    className="text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={() => setDeleteDocId(null)}
        title="删除文档"
        description="确定要删除此文档吗？此操作不可撤销。"
        onConfirm={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
