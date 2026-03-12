"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, RefreshCw, Cpu } from "lucide-react";
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

// ── Color palette matching the reference design ────────────────────────────────
const AGENT_COLORS = [
  { bg: "#0F4C81", accent: "#4DA6FF" },
  { bg: "#4A1942", accent: "#C77DFF" },
  { bg: "#1A3C34", accent: "#4ECBA8" },
  { bg: "#3D1C02", accent: "#FF8C42" },
  { bg: "#1C1C3D", accent: "#7B9FFF" },
  { bg: "#1e1b4b", accent: "#C77DFF" },
  { bg: "#083344", accent: "#4ECBA8" },
  { bg: "#431407", accent: "#FF8C42" },
  { bg: "#1e293b", accent: "#7B9FFF" },
  { bg: "#1e1b4b", accent: "#7B9FFF" },
] as const;

const EMOJIS = ["🤖", "🧠", "⚡", "🔧", "💡", "🌟", "🎯", "🔬", "📊", "🚀"];

// ── Inline badge (matching reference style) ────────────────────────────────────
function StatBadge({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="whitespace-nowrap rounded text-[11px] font-semibold"
      style={{
        background: color + "22",
        color: color,
        border: `1px solid ${color}44`,
        padding: "1px 7px",
      }}
    >
      {children}
    </span>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────────
function AgentCard({
  agent,
  onClick,
  onChat,
}: {
  agent: Agent;
  onClick: () => void;
  onChat: (e: React.MouseEvent) => void;
}) {
  const colorIdx = agent.colorIdx % AGENT_COLORS.length;
  const color = AGENT_COLORS[colorIdx];
  const emoji = EMOJIS[colorIdx % EMOJIS.length];
  const modelShort = agent.model.split("/").pop() ?? agent.model;
  const isActive = agent.status === "ACTIVE";

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border p-5 transition-all duration-200"
      style={{
        background: "#111118",
        borderColor: "#ffffff14",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = color.accent + "55";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${color.accent}18`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#ffffff14";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Header row: avatar + name + status */}
      <div className="mb-[14px] flex items-start gap-[14px]">
        {/* Avatar */}
        <div
          className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl text-[22px]"
          style={{
            background: color.bg,
            border: `1px solid ${color.accent}33`,
          }}
        >
          {emoji}
        </div>

        {/* Name + description */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[15px] font-bold text-white">
            {agent.name}
          </div>
          <div
            className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]"
            style={{ color: "#888" }}
          >
            {agent.description ?? "暂无描述"}
          </div>
        </div>

        {/* Online / offline indicator */}
        <div className="flex flex-shrink-0 items-center gap-[5px]">
          <div
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: isActive ? "#4ECBA8" : "#555" }}
          />
          <span
            className="text-[11px]"
            style={{ color: isActive ? "#4ECBA8" : "#555" }}
          >
            {isActive ? "在线" : "离线"}
          </span>
        </div>
      </div>

      {/* Badges row */}
      <div className="mb-[14px] flex flex-wrap gap-[6px]">
        <StatBadge color="#4DA6FF">
          📚 {agent._count.documents} 文档
        </StatBadge>
        <StatBadge color="#C77DFF">
          🔧 {agent._count.mcpBindings} MCP
        </StatBadge>
        <StatBadge color="#4ECBA8">
          ⭐ {agent._count.skillBindings} Skill
        </StatBadge>
      </div>

      {/* Footer row: sessions + chat button */}
      <div className="flex items-center justify-between">
        <span className="text-[12px]" style={{ color: "#666" }}>
          会话 {agent._count.sessions.toLocaleString()} 次
        </span>
        <button
          onClick={onChat}
          className="flex items-center gap-[6px] rounded-lg px-[16px] py-[7px] text-[13px] font-bold text-black transition-opacity hover:opacity-90"
          style={{ background: color.accent }}
        >
          <MessageSquare className="h-[13px] w-[13px]" />
          对话
        </button>
      </div>

      {/* Model label */}
      <div
        className="mt-2 text-[11px]"
        style={{ color: "#444" }}
      >
        {modelShort}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function AgentCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl border p-5"
      style={{ background: "#111118", borderColor: "#ffffff14" }}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="h-[46px] w-[46px] rounded-xl bg-[#1e1e2e]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-[#1e1e2e]" />
          <div className="h-3 w-48 rounded bg-[#1e1e2e]" />
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-5 w-20 rounded bg-[#1e1e2e]" />
        <div className="h-5 w-16 rounded bg-[#1e1e2e]" />
        <div className="h-5 w-16 rounded bg-[#1e1e2e]" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded bg-[#1e1e2e]" />
        <div className="h-8 w-20 rounded-lg bg-[#1e1e2e]" />
      </div>
    </div>
  );
}

// ── Main Grid ──────────────────────────────────────────────────────────────────
export default function AgentGrid() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/proxy/api/agents");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json()) as {
        success: boolean;
        data?: { agents: Agent[] };
        error?: string;
      };
      if (data.success) setAgents(data.data?.agents ?? []);
      else setError(data.error ?? "加载失败");
    } catch {
      setError("无法连接到服务器");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#080810" }}
    >
      <div className="p-6 md:p-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-white">
              Agent 工作台
            </h1>
            <p className="mt-1 text-[13px]" style={{ color: "#555" }}>
              管理您的 AI Agent，共{" "}
              <span style={{ color: "#888" }}>{agents.length}</span> 个
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAgents}
              disabled={loading}
              className={cn(
                "flex items-center gap-[6px] rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 hover:border-[#ffffff30] hover:text-[#aaa]",
              )}
              style={{
                borderColor: "#ffffff18",
                color: "#666",
                background: "transparent",
              }}
            >
              <RefreshCw
                className={cn("h-[14px] w-[14px]", loading && "animate-spin")}
              />
              刷新
            </button>

            <CreateAgentWizard onCreated={fetchAgents} />
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div
            className="mb-6 rounded-lg border px-4 py-3 text-[13px]"
            style={{
              borderColor: "#ff6b6b44",
              background: "#ff6b6b11",
              color: "#ff6b6b",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Grid ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20"
            style={{ borderColor: "#ffffff18", background: "#111118" }}
          >
            <Cpu className="mb-4 h-12 w-12" style={{ color: "#333" }} />
            <p className="text-[16px] font-medium" style={{ color: "#555" }}>
              还没有 Agent
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "#444" }}>
              点击「新建 Agent」开始
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
                onChat={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/agents/${agent.id}/chat`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
