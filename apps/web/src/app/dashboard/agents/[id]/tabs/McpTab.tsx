"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Server, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface McpServer {
  id: string;
  name: string;
  description: string | null;
  endpoint: string;
  authType: string;
  icon: string | null;
}

interface Binding extends McpServer {
  toolsAllowed: string[];
}

export default function McpTab({ agentId }: { agentId: string }) {
  const [bound, setBound] = useState<Binding[]>([]);
  const [registry, setRegistry] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        fetch(`/api/proxy/api/agents/${agentId}/mcp`).then(r => r.json()) as Promise<{ success: boolean; data?: { mcpServers: Binding[] } }>,
        fetch(`/api/proxy/api/mcp/servers`).then(r => r.json()) as Promise<{ success: boolean; data?: { servers: McpServer[] } }>,
      ]);
      setBound(b.data?.mcpServers ?? []);
      setRegistry(r.data?.servers ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, [agentId]);

  const boundIds = new Set(bound.map(b => b.id));
  const available = registry.filter(s => !boundIds.has(s.id));

  const add = async (mcpServerId: string) => {
    setAddingId(mcpServerId);
    try {
      await fetch(`/api/proxy/api/agents/${agentId}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcpServerId }),
      });
      await fetch_();
      if (available.length <= 1) setShowAdd(false);
    } finally {
      setAddingId(null);
    }
  };

  const remove = async (mcpServerId: string) => {
    setRemovingId(mcpServerId);
    try {
      await fetch(`/api/proxy/api/agents/${agentId}/mcp/${mcpServerId}`, { method: "DELETE" });
      setBound(prev => prev.filter(b => b.id !== mcpServerId));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Bound list */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">已绑定 <span className="font-semibold text-gray-200">{bound.length}</span> 个 MCP 工具</p>
        {available.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(v => !v)}
            className="gap-1 border-gray-700 text-gray-300 hover:border-gray-500"
          >
            <Plus className="h-3.5 w-3.5" /> 添加工具
          </Button>
        )}
      </div>

      {bound.length === 0 && !showAdd && (
        <EmptyState icon={<Server className="h-8 w-8 text-gray-700" />} text="尚未绑定 MCP 工具" />
      )}

      {bound.map(b => (
        <ServerCard key={b.id}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800 text-lg">
              {b.icon ?? <Server className="h-4 w-4 text-gray-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-100">{b.name}</p>
              <p className="truncate text-xs text-gray-500">{b.endpoint}</p>
              {Array.isArray(b.toolsAllowed) && b.toolsAllowed.length > 0 && (
                <p className="text-xs text-gray-600 mt-0.5">工具: {(b.toolsAllowed as string[]).join(", ")}</p>
              )}
            </div>
            <button
              onClick={() => remove(b.id)}
              disabled={removingId === b.id}
              className="rounded p-1.5 text-gray-600 hover:text-red-400 disabled:opacity-40"
            >
              {removingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        </ServerCard>
      ))}

      {/* Add panel */}
      {showAdd && available.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-4">
          <p className="mb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">从注册表添加</p>
          <div className="space-y-2">
            {available.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-700 text-sm">
                  {s.icon ?? <Server className="h-3.5 w-3.5 text-gray-500" />}
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

function ServerCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">{children}</div>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-lg border border-gray-800 bg-gray-900" />)}
    </div>
  );
}
