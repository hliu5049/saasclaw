"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import RagTab      from "./tabs/RagTab";
import McpTab      from "./tabs/McpTab";
import SkillsTab   from "./tabs/SkillsTab";
import ChannelsTab from "./tabs/ChannelsTab";
import MemoryTab   from "./tabs/MemoryTab";

// ── Color palette matching reference ──────────────────────────────────────────
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

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  colorIdx: number;
  model: string;
  agentsMd: string;
  gateway: { name: string; status: string };
  _count: { sessions: number; documents: number; skillBindings: number; mcpBindings: number };
}

const TAB_ITEMS = [
  { value: "rag",      label: "RAG 知识库" },
  { value: "mcp",      label: "MCP 工具" },
  { value: "skills",   label: "Skills" },
  { value: "channels", label: "开放渠道" },
  { value: "memory",   label: "记忆" },
] as const;

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string | number;
  label: string;
}) {
  return (
    <div
      className="rounded-[10px] border px-4 py-[14px]"
      style={{ background: "#111118", borderColor: "#ffffff0e" }}
    >
      <div className="mb-[6px] text-[20px]">{icon}</div>
      <div className="text-[22px] font-black text-white">{value}</div>
      <div className="text-[12px]" style={{ color: "#666" }}>
        {label}
      </div>
    </div>
  );
}

export default function AgentDetailClient({ agent }: { agent: Agent }) {
  const [tab, setTab] = useState<string>("rag");
  const colorIdx = agent.colorIdx % AGENT_COLORS.length;
  const color = AGENT_COLORS[colorIdx];
  const emoji = EMOJIS[colorIdx % EMOJIS.length];
  const isActive = agent.status === "ACTIVE";

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "#080810" }}
    >
      <div className="px-7 py-6">
        {/* ── Back + Chat actions ─────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-[6px] rounded-lg border px-3 py-[7px] text-[13px] font-medium transition-colors hover:border-[#ffffff30] hover:text-[#aaa]"
            style={{ borderColor: "#ffffff18", color: "#666" }}
          >
            <ArrowLeft className="h-[14px] w-[14px]" />
            返回工作台
          </Link>

          <div className="flex gap-2">
            <Link
              href={`/dashboard/agents/${agent.id}/chat`}
              className="inline-flex items-center gap-[6px] rounded-lg px-[16px] py-[8px] text-[13px] font-bold text-black transition-opacity hover:opacity-90"
              style={{ background: color.accent }}
            >
              <MessageSquare className="h-[13px] w-[13px]" />
              开始对话
            </Link>
          </div>
        </div>

        {/* ── Agent Header ────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[14px] text-[28px]"
            style={{
              background: color.bg,
              border: `1px solid ${color.accent}33`,
            }}
          >
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-black text-white">
                {agent.name}
              </h1>
              <span
                className="inline-flex items-center gap-[5px] rounded px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: isActive ? "#4ECBA822" : "#55555522",
                  color: isActive ? "#4ECBA8" : "#888",
                  border: `1px solid ${isActive ? "#4ECBA844" : "#55555544"}`,
                }}
              >
                <span
                  className="inline-block h-[6px] w-[6px] rounded-full"
                  style={{ background: isActive ? "#4ECBA8" : "#666" }}
                />
                {isActive
                  ? "运行中"
                  : agent.status === "PAUSED"
                  ? "已暂停"
                  : "已删除"}
              </span>
            </div>
            {agent.description && (
              <p className="mt-[3px] text-[13px]" style={{ color: "#888" }}>
                {agent.description}
              </p>
            )}
            <div
              className="mt-2 flex flex-wrap gap-4 text-[12px]"
              style={{ color: "#555" }}
            >
              <span>{agent.model.split("/").pop()}</span>
              <span>网关: {agent.gateway.name}</span>
            </div>
          </div>
        </div>

        {/* ── Stats grid ──────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon="💬"
            value={agent._count.sessions.toLocaleString()}
            label="总会话数"
          />
          <StatCard
            icon="📚"
            value={agent._count.documents}
            label="知识文档"
          />
          <StatCard
            icon="🔧"
            value={agent._count.mcpBindings}
            label="接入工具"
          />
          <StatCard
            icon="⭐"
            value={agent._count.skillBindings}
            label="绑定技能"
          />
        </div>

        {/* ── Tabs (reference-styled) ─────────────────────────────────── */}
        <Tabs value={tab} onValueChange={setTab}>
          {/* Custom tab bar */}
          <div
            className="mb-5 flex border-b"
            style={{ borderColor: "#ffffff10" }}
          >
            {TAB_ITEMS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className="cursor-pointer whitespace-nowrap bg-transparent px-[18px] py-[9px] text-[13px] transition-colors"
                style={{
                  color: tab === t.value ? "#fff" : "#666",
                  fontWeight: tab === t.value ? 700 : 500,
                  border: "none",
                  borderBottom: `2px solid ${tab === t.value ? color.accent : "transparent"}`,
                  outline: "none",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <TabsContent value="rag">
            <RagTab agentId={agent.id} />
          </TabsContent>
          <TabsContent value="mcp">
            <McpTab agentId={agent.id} />
          </TabsContent>
          <TabsContent value="skills">
            <SkillsTab agentId={agent.id} />
          </TabsContent>
          <TabsContent value="channels">
            <ChannelsTab agentId={agent.id} />
          </TabsContent>
          <TabsContent value="memory">
            <MemoryTab agentId={agent.id} initialAgentsMd={agent.agentsMd} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
