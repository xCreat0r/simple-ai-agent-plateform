import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileText, Upload, Trash2, ArrowLeft } from "lucide-react";

function statusBadge(doc: { status?: string; chunkCount: number; error?: string }) {
  if (doc.status === "processing") {
    return <Badge variant="outline">嵌入中...</Badge>;
  }
  if (doc.status === "failed") {
    return <Badge variant="destructive" title={doc.error || "嵌入失败"}>嵌入失败</Badge>;
  }
  return <Badge variant="secondary">{doc.chunkCount} 分块</Badge>;
}

export function KnowledgeDetail() {
  const { id: kbId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteKbOpen, setDeleteKbOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: kb } = useQuery({
    queryKey: ["knowledge", kbId],
    queryFn: () => api.getKnowledgeBase(kbId!),
    enabled: !!kbId,
  });

  const { data: documents, isLoading, isError } = useQuery({
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

  const deleteKbMutation = useMutation({
    mutationFn: () => api.deleteKnowledgeBase(kbId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      navigate("/knowledge");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadDocument(kbId!, file);
      queryClient.invalidateQueries({ queryKey: ["documents", kbId] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/knowledge")} aria-label="返回知识库列表">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{kb?.name || "知识库"}</h1>
            <p className="text-sm text-neutral-500">管理知识库文档</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.txt,.csv,.json,.md,.markdown"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1 h-4 w-4" />{uploading ? "上传中..." : "上传文件"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteKbOpen(true)} aria-label="删除知识库">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{uploadError}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-neutral-500">加载中...</div>
      ) : isError ? (
        <div className="flex items-center justify-center h-64 text-neutral-500">加载失败，请稍后重试</div>
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

      <ConfirmDialog
        open={deleteKbOpen}
        onOpenChange={setDeleteKbOpen}
        title="删除知识库"
        description="确定要删除此知识库吗？该知识库及其所有文档将被删除，此操作不可撤销。"
        onConfirm={() => deleteKbMutation.mutate()}
        loading={deleteKbMutation.isPending}
      />
    </div>
  );
}
