"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Settings,
  Plus,
  Search,
  ChevronRight,
  Loader2,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CreateAgentWizard from "./CreateAgentWizard";

// ── Agent type (minimal, for sidebar list) ─────────────────────────────────────
interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  colorIdx: number;
  model: string;
  _count: { sessions: number; mcpBindings: number };
}

// ── Color palette matching the reference dark theme ────────────────────────────
const AGENT_COLORS = [
  { bg: "bg-[#0F4C81]", accent: "#4DA6FF", border: "border-[#4DA6FF33]" },
  { bg: "bg-[#4A1942]", accent: "#C77DFF", border: "border-[#C77DFF33]" },
  { bg: "bg-[#1A3C34]", accent: "#4ECBA8", border: "border-[#4ECBA833]" },
  { bg: "bg-[#3D1C02]", accent: "#FF8C42", border: "border-[#FF8C4233]" },
  { bg: "bg-[#1C1C3D]", accent: "#7B9FFF", border: "border-[#7B9FFF33]" },
  { bg: "bg-violet-900", accent: "#C77DFF", border: "border-violet-500/20" },
  { bg: "bg-cyan-900",   accent: "#4ECBA8", border: "border-cyan-500/20" },
  { bg: "bg-orange-900", accent: "#FF8C42", border: "border-orange-500/20" },
  { bg: "bg-slate-800",  accent: "#7B9FFF", border: "border-slate-500/20" },
  { bg: "bg-indigo-900", accent: "#7B9FFF", border: "border-indigo-500/20" },
] as const;

const EMOJIS = ["🤖", "🧠", "⚡", "🔧", "💡", "🌟", "🎯", "🔬", "📊", "🚀"];

// ── Left icon sidebar navigation item ─────────────────────────────────────────
function SideNavItem({
  id,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  id: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200",
        active
          ? "border-[#4DA6FF33] bg-[#4DA6FF22] text-[#4DA6FF]"
          : "border-transparent bg-transparent text-[#555] hover:border-[#ffffff14] hover:text-[#888]",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

// ── Agent list item in middle panel ───────────────────────────────────────────
function AgentListItem({
  agent,
  selected,
  onClick,
}: {
  agent: AgentSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const colorIdx = agent.colorIdx % AGENT_COLORS.length;
  const color = AGENT_COLORS[colorIdx];
  const emoji = EMOJIS[colorIdx % EMOJIS.length];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-[10px] rounded-[10px] px-[10px] py-[10px] text-left transition-all duration-200",
        selected
          ? "border bg-[#1a1a2e]"
          : "border border-transparent hover:bg-[#ffffff08]",
      )}
      style={
        selected
          ? { borderColor: color.accent + "44" }
          : undefined
      }
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] text-[18px] border",
          color.bg,
          color.border,
        )}
      >
        {emoji}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#ddd]">
          {agent.name}
        </div>
        <div className="text-[11px] text-[#555]">
          {agent._count.sessions} 会话 · {agent._count.mcpBindings} 工具
        </div>
      </div>

      {/* Online dot */}
      <div
        className={cn(
          "h-[6px] w-[6px] flex-shrink-0 rounded-full",
          agent.status === "ACTIVE" ? "bg-[#4ECBA8]" : "bg-[#555]",
        )}
      />
    </button>
  );
}

// ── Dashboard Layout ───────────────────────────────────────────────────────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sideTab, setSideTab] = useState<"agents" | "llm" | "settings">("agents");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [search, setSearch] = useState("");

  // Determine which agent is selected from the URL
  const selectedAgentId = (() => {
    const match = pathname.match(/\/dashboard\/agents\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/proxy/api/agents");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json() as {
        success: boolean;
        data?: { agents: AgentSummary[] };
      };
      if (data.success) setAgents(data.data?.agents ?? []);
    } catch {
      // silently fail – main page will show its own error
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleAgentClick = (agent: AgentSummary) => {
    router.push(`/dashboard/agents/${agent.id}`);
  };

  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: "100vh",
        background: "#080810",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#fff",
      }}
    >
      {/* ─── Scrollbar styling ─────────────────────────────────────────────── */}
      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>

      {/* ─── 1. Icon-only left sidebar (64px) ─────────────────────────────── */}
      <div
        className="flex flex-shrink-0 flex-col items-center gap-2 border-r py-4"
        style={{
          width: 64,
          background: "#0a0a12",
          borderColor: "#ffffff0e",
        }}
      >
        {/* Logo */}
        <div
          className="mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[18px]"
          style={{
            background: "linear-gradient(135deg, #4DA6FF, #7B9FFF)",
          }}
        >
          🦞
        </div>

        <SideNavItem
          id="agents"
          icon={Bot}
          label="Agents"
          active={sideTab === "agents"}
          onClick={() => {
            setSideTab("agents");
            router.push("/dashboard");
          }}
        />
        <SideNavItem
          id="llm"
          icon={Cpu}
          label="模型管理"
          active={sideTab === "llm"}
          onClick={() => {
            setSideTab("llm");
            router.push("/dashboard/llm-providers");
          }}
        />
        <SideNavItem
          id="settings"
          icon={Settings}
          label="设置"
          active={sideTab === "settings"}
          onClick={() => setSideTab("settings")}
        />
      </div>

      {/* ─── 2. Agent list panel (280px) ───────────────────────────────────── */}
      <div
        className="flex flex-shrink-0 flex-col border-r"
        style={{
          width: 280,
          background: "#0c0c14",
          borderColor: "#ffffff0e",
        }}
      >
        {/* Panel header */}
        <div className="px-4 pb-[14px] pt-[18px]">
          <div className="mb-[14px] flex items-center justify-between">
            <span
              className="text-[15px] font-extrabold"
              style={{ color: "#fff" }}
            >
              Agent 列表
            </span>

            {/* Create button (small +) */}
            <CreateAgentWizard
              trigger={
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-lg font-black text-black"
                  style={{ background: "#4DA6FF" }}
                >
                  <Plus className="h-[15px] w-[15px]" />
                </button>
              }
              onCreated={fetchAgents}
            />
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg border px-[12px] py-[8px]"
            style={{
              background: "#0d0d18",
              borderColor: "#ffffff0e",
            }}
          >
            <Search className="h-[14px] w-[14px] flex-shrink-0 text-[#555]" />
            <input
              type="text"
              placeholder="搜索 Agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[13px] text-[#aaa] outline-none placeholder:text-[#555]"
            />
          </div>
        </div>

        {/* Agent list (scrollable) */}
        <div className="flex-1 overflow-y-auto px-[10px] pb-[10px]">
          {loadingAgents ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#444]" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-[#444]">
              {search ? "没有匹配的 Agent" : "还没有 Agent"}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredAgents.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  selected={agent.id === selectedAgentId}
                  onClick={() => handleAgentClick(agent)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom: New Agent button */}
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid #ffffff0e" }}
        >
          <CreateAgentWizard
            trigger={
              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-[10px] text-[13px] font-semibold text-[#4DA6FF] transition-colors hover:bg-[#4DA6FF1a]"
                style={{
                  background: "#4DA6FF11",
                  borderColor: "#4DA6FF44",
                  borderStyle: "dashed",
                }}
              >
                <Plus className="h-[14px] w-[14px]" />
                新建 Agent
              </button>
            }
            onCreated={fetchAgents}
          />
        </div>
      </div>

      {/* ─── 3. Main content area ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
