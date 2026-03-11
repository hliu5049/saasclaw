"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, MessageSquare, FileText, Wrench, Cpu, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CreateAgentWizard from "./CreateAgentWizard";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  colorIdx: number;
  model: string;
  createdAt: string;
  gateway: { id: string; name: string; status: string };
  _count: { sessions: number; documents: number; skillBindings: number; mcpBindings: number };
}

// ── Color palette (must be full class strings for Tailwind scanning) ───────────

const COLOR_BG = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-slate-500",
  "bg-indigo-500",
] as const;

// ── Agent Card ─────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const router = useRouter();
  const color = COLOR_BG[agent.colorIdx % COLOR_BG.length];

  const statusVariant =
    agent.status === "ACTIVE" ? "success" : agent.status === "PAUSED" ? "warning" : "muted";

  const statusLabel =
    agent.status === "ACTIVE" ? "运行中" : agent.status === "PAUSED" ? "已暂停" : "已删除";

  const modelShort = agent.model.split("/").pop() ?? agent.model;

  return (
    <Link href={`/dashboard/agents/${agent.id}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-all hover:border-gray-600 hover:shadow-lg hover:shadow-black/40">
      {/* Color strip */}
      <div className={cn("h-1 w-full", color)} />

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", color, "bg-opacity-20")}>
              <Bot className={cn("h-4 w-4", color.replace("bg-", "text-"))} />
            </div>
            <h3 className="truncate font-semibold text-gray-50">{agent.name}</h3>
          </div>
          <Badge variant={statusVariant} className="flex-shrink-0 text-[11px]">
            {statusLabel}
          </Badge>
        </div>

        {agent.description ? (
          <p className="line-clamp-2 text-sm text-gray-400">{agent.description}</p>
        ) : (
          <p className="text-sm italic text-gray-600">暂无描述</p>
        )}

        <div className="mt-auto">
          <p className="mb-3 text-[11px] text-gray-600">{modelShort}</p>

          <div className="flex items-center justify-between">
            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {agent._count.sessions}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {agent._count.documents}
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" />
                {agent._count.skillBindings + agent._count.mcpBindings}
              </span>
            </div>

            {/* Chat shortcut */}
            <button
              onClick={e => { e.preventDefault(); router.push(`/dashboard/agents/${agent.id}/chat`); }}
              className="flex items-center gap-1 rounded-lg bg-blue-600/80 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-blue-500"
            >
              <MessageSquare className="h-3 w-3" /> 对话
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function AgentCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      <div className="h-1 w-full bg-gray-800 animate-pulse" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-800 animate-pulse" />
          <div className="h-4 w-32 rounded bg-gray-800 animate-pulse" />
        </div>
        <div className="h-3 w-full rounded bg-gray-800 animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-gray-800 animate-pulse" />
        <div className="flex gap-3 mt-auto pt-2">
          <div className="h-3 w-8 rounded bg-gray-800 animate-pulse" />
          <div className="h-3 w-8 rounded bg-gray-800 animate-pulse" />
          <div className="h-3 w-8 rounded bg-gray-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Main Grid ──────────────────────────────────────────────────────────────────

export default function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/proxy/api/agents");
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json() as { success: boolean; data?: { agents: Agent[] }; error?: string };
      if (data.success) setAgents(data.data?.agents ?? []);
      else setError(data.error ?? "加载失败");
    } catch {
      setError("无法连接到服务器");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-50">Agent 工作台</h1>
          <p className="mt-1 text-sm text-gray-500">
            管理您的 AI Agent，共 {agents.length} 个
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAgents}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            刷新
          </button>
          <CreateAgentWizard onCreated={fetchAgents} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/50 py-20">
          <Cpu className="mb-4 h-12 w-12 text-gray-700" />
          <p className="text-lg font-medium text-gray-500">还没有 Agent</p>
          <p className="mt-1 text-sm text-gray-600">点击「新建 Agent」开始</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {agents.map((a) => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}
    </div>
  );
}
