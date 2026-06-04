"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Upload, X, ChevronDown, ChevronRight } from "lucide-react";

interface DocItem {
  id: string;
  filename: string;
  createdAt: string;
  chunkCount: number;
}

export default function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/knowledge/${id}`)
      .then((r) => r.json())
      .then((d) => setName(d.name));
    loadDocs();
  }, [id]);

  async function loadDocs() {
    const res = await fetch(`/api/knowledge/${id}/documents`);
    setDocs(await res.json());
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/knowledge/${id}/documents`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "上传失败");
    }

    setUploading(false);
    loadDocs();
    if (fileRef.current) fileRef.current.value = "";
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/knowledge/${id}/documents/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    loadDocs();
  }

  async function togglePreview(doc: DocItem) {
    if (expandedDoc === doc.id) {
      setExpandedDoc(null);
      setPreviewContent("");
    } else {
      setExpandedDoc(doc.id);
      const res = await fetch(`/api/knowledge/${id}/documents/${doc.id}/content`);
      const data = await res.json();
      setPreviewContent(data.content);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/knowledge" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← 知识库列表
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium">{name}</h1>
        <label className={uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "上传中..." : "上传文件"}
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p>还没有文档</p>
          <p className="text-xs mt-1">支持 TXT、Markdown、PDF 格式，最大 10MB</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id}>
              <div className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => togglePreview(d)}
                    className="flex items-center gap-1 text-sm hover:text-gray-900 text-left"
                  >
                    {expandedDoc === d.id
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span className="truncate">{d.filename}</span>
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(d.createdAt).toLocaleDateString("zh-CN")}
                    <span className="mx-1">·</span>
                    {d.chunkCount} 个块
                  </p>
                </div>
                <button onClick={() => setDeleteTarget(d)} className="text-gray-400 hover:text-red-600 shrink-0 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {expandedDoc === d.id && (
                <div className="mt-1 px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {previewContent.slice(0, 3000)}
                    {previewContent.length > 3000 && "\n\n... 内容过长，已截断"}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除文档"
        description={`确定要删除「${deleteTarget?.filename ?? ""}」吗？`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
