"use client";

import { useState } from "react";
import { Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MemoryTabProps {
  agentId: string;
  initialAgentsMd: string;
}

export default function MemoryTab({ agentId, initialAgentsMd }: MemoryTabProps) {
  const [content, setContent] = useState(initialAgentsMd);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isDirty = content !== initialAgentsMd;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/proxy/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentsMd: content }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-200">AGENTS.md</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Agent 的长期记忆与上下文笔记，每次会话前自动注入
          </p>
        </div>
        <Button
          onClick={save}
          disabled={saving || (!isDirty && !saved)}
          size="sm"
          className={cn(
            "flex-shrink-0 gap-1.5",
            saved
              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white",
            !isDirty && !saved && "opacity-50",
          )}
        >
          {saving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中</>
          ) : saved ? (
            <><Check className="h-3.5 w-3.5" /> 已保存</>
          ) : (
            <><Save className="h-3.5 w-3.5" /> 保存</>
          )}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <Textarea
        value={content}
        onChange={e => { setContent(e.target.value); setSaved(false); }}
        placeholder={"# 记忆\n\n在这里记录 Agent 需要长期保留的信息：\n- 用户偏好\n- 重要约定\n- 上次会话的关键结论\n\n这些内容会在每次对话开始时提供给 Agent。"}
        className="min-h-[420px] border-gray-700 bg-gray-800 font-mono text-sm text-gray-50 placeholder:text-gray-600 focus-visible:ring-gray-600"
      />

      <p className="text-right text-xs text-gray-600">
        {content.length} 字符
        {isDirty && <span className="ml-2 text-yellow-500">● 未保存</span>}
      </p>
    </div>
  );
}
