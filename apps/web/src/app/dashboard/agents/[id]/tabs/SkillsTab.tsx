"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  version: string;
}

export default function SkillsTab({ agentId }: { agentId: string }) {
  const [bound, setBound] = useState<Skill[]>([]);
  const [hub, setHub] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const [b, h] = await Promise.all([
        fetch(`/api/proxy/api/agents/${agentId}/skills`).then(r => r.json()) as Promise<{ success: boolean; data?: { skills: Skill[] } }>,
        fetch(`/api/proxy/api/skills`).then(r => r.json()) as Promise<{ success: boolean; data?: { skills: Skill[] } }>,
      ]);
      setBound(b.data?.skills ?? []);
      setHub(h.data?.skills ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, [agentId]);

  const boundIds = new Set(bound.map(s => s.id));
  const available = hub.filter(s => !boundIds.has(s.id));

  const add = async (skillId: string) => {
    setAddingId(skillId);
    try {
      await fetch(`/api/proxy/api/agents/${agentId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      await fetch_();
      if (available.length <= 1) setShowAdd(false);
    } finally {
      setAddingId(null);
    }
  };

  const remove = async (skillId: string) => {
    setRemovingId(skillId);
    try {
      await fetch(`/api/proxy/api/agents/${agentId}/skills/${skillId}`, { method: "DELETE" });
      setBound(prev => prev.filter(s => s.id !== skillId));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg border border-gray-800 bg-gray-900" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">已分配 <span className="font-semibold text-gray-200">{bound.length}</span> 个技能</p>
        {available.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(v => !v)}
            className="gap-1 border-gray-700 text-gray-300 hover:border-gray-500"
          >
            <Plus className="h-3.5 w-3.5" /> 从 Hub 添加
          </Button>
        )}
      </div>

      {bound.length === 0 && !showAdd && (
        <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center">
          <Wrench className="mx-auto mb-2 h-8 w-8 text-gray-700" />
          <p className="text-sm text-gray-500">尚未分配技能</p>
        </div>
      )}

      {bound.map(s => (
        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800 text-lg">
            {s.icon ?? <Wrench className="h-4 w-4 text-gray-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-100">{s.name}</p>
            {s.description && <p className="truncate text-xs text-gray-500">{s.description}</p>}
          </div>
          <span className="flex-shrink-0 rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-500">
            v{s.version}
          </span>
          <button
            onClick={() => remove(s.id)}
            disabled={removingId === s.id}
            className="rounded p-1.5 text-gray-600 hover:text-red-400 disabled:opacity-40"
          >
            {removingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      ))}

      {showAdd && available.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-4">
          <p className="mb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Skill Hub</p>
          <div className="space-y-2">
            {available.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-700 text-sm">
                  {s.icon ?? <Wrench className="h-3.5 w-3.5 text-gray-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200">{s.name}</p>
                  {s.description && <p className="text-xs text-gray-500 truncate">{s.description}</p>}
                </div>
                <button
                  onClick={() => add(s.id)}
                  disabled={addingId === s.id}
                  className="flex-shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {addingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "添加"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
