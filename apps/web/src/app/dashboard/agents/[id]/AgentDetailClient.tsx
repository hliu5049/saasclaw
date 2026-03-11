"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import RagTab      from "./tabs/RagTab";
import McpTab      from "./tabs/McpTab";
import SkillsTab   from "./tabs/SkillsTab";
import ChannelsTab from "./tabs/ChannelsTab";
import MemoryTab   from "./tabs/MemoryTab";

const COLOR_BG = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-red-500",
  "bg-pink-500",  "bg-cyan-500",  "bg-yellow-500",  "bg-slate-500",  "bg-indigo-500",
] as const;

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
  { value: "rag",      label: "知识库" },
  { value: "mcp",      label: "MCP 工具" },
  { value: "skills",   label: "技能" },
  { value: "channels", label: "渠道" },
  { value: "memory",   label: "记忆" },
] as const;

export default function AgentDetailClient({ agent }: { agent: Agent }) {
  const [tab, setTab] = useState<string>("rag");
  const color = COLOR_BG[agent.colorIdx % COLOR_BG.length];

  const statusVariant =
    agent.status === "ACTIVE" ? "success" : agent.status === "PAUSED" ? "warning" : "muted";
  const statusLabel =
    agent.status === "ACTIVE" ? "运行中" : agent.status === "PAUSED" ? "已暂停" : "已删除";

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Top colour bar ─────────────────────────────────────────────── */}
      <div className={cn("h-1 w-full", color)} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-950 px-6 py-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 返回工作台
            </Link>
            <Link
              href={`/dashboard/agents/${agent.id}/chat`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <MessageSquare className="h-3.5 w-3.5" /> 打开对话
            </Link>
          </div>

          <div className="flex items-start gap-4">
            <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl", color, "bg-opacity-20")}>
              <Bot className={cn("h-6 w-6", color.replace("bg-", "text-"))} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-50">{agent.name}</h1>
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
              {agent.description && (
                <p className="mt-0.5 text-sm text-gray-400">{agent.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                <span>{agent.model.split("/").pop()}</span>
                <span>网关: {agent.gateway.name}</span>
                <span>{agent._count.sessions} 会话</span>
                <span>{agent._count.documents} 文档</span>
                <span>{agent._count.skillBindings + agent._count.mcpBindings} 工具</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 w-full justify-start overflow-x-auto">
            {TAB_ITEMS.map(t => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

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
