"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, FileText, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RagDoc {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: "PROCESSING" | "READY" | "FAILED";
  chunkCount: number;
  errorMsg: string | null;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_MAP = {
  PROCESSING: { label: "处理中", variant: "warning",  Icon: Clock },
  READY:      { label: "就绪",   variant: "success",  Icon: CheckCircle2 },
  FAILED:     { label: "失败",   variant: "destructive", Icon: AlertCircle },
} as const;

export default function RagTab({ agentId }: { agentId: string }) {
  const [docs, setDocs] = useState<RagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/api/rag/${agentId}/documents`);
      const data = await res.json() as { success: boolean; data?: { docs: RagDoc[] } };
      if (data.success) setDocs(data.data?.docs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [agentId]);

  const uploadFiles = async (files: File[]) => {
    const allowed = files.filter(f => /\.(txt|md|pdf|docx)$/i.test(f.name));
    if (!allowed.length) return;
    setUploading(true);
    try {
      await Promise.all(allowed.map(file => {
        const fd = new FormData();
        fd.append("file", file);
        return fetch(`/api/proxy/api/rag/${agentId}/documents`, { method: "POST", body: fd });
      }));
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (docId: string) => {
    setDeletingId(docId);
    try {
      await fetch(`/api/proxy/api/rag/${agentId}/documents/${docId}`, { method: "DELETE" });
      setDocs(prev => prev.filter(d => d.id !== docId));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors",
          dragging ? "border-blue-500 bg-blue-500/5" : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/30",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? (
          <><Loader2 className="mb-2 h-7 w-7 animate-spin text-blue-400" /><p className="text-sm text-gray-400">上传中…</p></>
        ) : (
          <><Upload className="mb-2 h-7 w-7 text-gray-600" /><p className="text-sm text-gray-400">拖拽或点击上传文档</p><p className="mt-0.5 text-xs text-gray-600">.txt .md .pdf .docx · 最大 50 MB</p></>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx"
          className="hidden"
          onChange={e => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          共 <span className="font-semibold text-gray-200">{docs.length}</span> 个文档
        </p>
        <button
          onClick={fetchDocs}
          disabled={loading}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-300"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> 刷新
        </button>
      </div>

      {/* Doc list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-gray-800 bg-gray-900" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">还没有文档，上传后 Agent 可检索知识库</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const { label, variant, Icon } = STATUS_MAP[doc.status];
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
                <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />
                <div className="flex flex-1 min-w-0 flex-col">
                  <span className="truncate text-sm text-gray-200">{doc.filename}</span>
                  <span className="text-xs text-gray-600">
                    {formatSize(doc.fileSize)}
                    {doc.status === "READY" && ` · ${doc.chunkCount} 个分块`}
                    {doc.status === "FAILED" && doc.errorMsg && ` · ${doc.errorMsg}`}
                  </span>
                </div>
                <Badge variant={variant} className="flex-shrink-0 gap-1 text-[11px]">
                  <Icon className="h-3 w-3" />
                  {label}
                </Badge>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  disabled={deletingId === doc.id}
                  className="ml-1 rounded p-1 text-gray-600 hover:text-red-400 disabled:opacity-40"
                >
                  {deletingId === doc.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
