"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, RotateCcw, Loader2 } from "lucide-react";
import { useChat }       from "@/hooks/use-chat";
import type { StreamStatus } from "@/hooks/use-agent-stream";
import { MessageList }   from "@/components/chat/message-list";
import { InputBar }      from "@/components/chat/input-bar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string;
  name: string;
  colorIdx: number;
  status: string;
  description: string | null;
}

const COLOR_BG = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-red-500",
  "bg-pink-500",  "bg-cyan-500",  "bg-yellow-500",  "bg-slate-500",  "bg-indigo-500",
] as const;

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status, retryCount }: { status: StreamStatus; retryCount: number }) {
  const map: Record<StreamStatus, { color: string; label: string }> = {
    idle:         { color: "bg-gray-500",                    label: "未连接" },
    connecting:   { color: "bg-yellow-400 animate-pulse",    label: "连接中" },
    connected:    { color: "bg-emerald-400",                 label: "已连接" },
    reconnecting: { color: "bg-yellow-400 animate-pulse",    label: `重连中 (${retryCount})` },
    closed:       { color: "bg-red-500",                     label: "已断开" },
  };
  const { color, label } = map[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", color)} />
      {label}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ChatInterface({
  agentId,
  backHref,
}: {
  agentId: string;
  backHref?: string;
}) {
  const [agent,     setAgent]     = useState<AgentInfo | null>(null);
  const [resetting, setResetting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages, isStreaming,
    streamingText, thinkingText, activeTools,
    streamStatus, streamRetryCount,
    sendMessage, loadHistory, resetSession,
  } = useChat({ agentId });

  // ── Fetch agent info ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/proxy/api/agents/${agentId}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: { agent: AgentInfo } }) => {
        if (d.success) setAgent(d.data?.agent ?? null);
      })
      .catch(() => {});
  }, [agentId]);

  // ── Load history on mount ─────────────────────────────────────────────────

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Auto-scroll on new content ────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText, isStreaming]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, _images?: File[]) => {
      // Images will be handled in a future extension
      await sendMessage(text);
    },
    [sendMessage],
  );

  const handleReset = async () => {
    setResetting(true);
    await resetSession();
    setResetting(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const colorIdx  = agent?.colorIdx ?? 0;
  const color     = COLOR_BG[colorIdx % COLOR_BG.length];
  const agentName = agent?.name ?? "Agent";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-950">

      {/* Top colour strip */}
      <div className={cn("h-0.5 w-full flex-shrink-0", color)} />

      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-800 bg-gray-950 px-4 py-3">
        <Link
          href={backHref ?? `/dashboard/agents/${agentId}`}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full", color, "bg-opacity-20")}>
          <Bot className={cn("h-4 w-4", color.replace("bg-", "text-"))} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-100">{agentName}</p>
          <StatusDot status={streamStatus} retryCount={streamRetryCount} />
        </div>

        <button
          onClick={handleReset}
          disabled={resetting}
          title="清空会话"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-40"
        >
          {resetting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RotateCcw className="h-4 w-4" />}
        </button>
      </header>

      {/* Reconnecting / closed banner */}
      {(streamStatus === "reconnecting" || streamStatus === "closed") && (
        <div className="flex-shrink-0 bg-yellow-500/10 px-4 py-1.5 text-center text-xs text-yellow-400">
          {streamStatus === "reconnecting"
            ? `连接已断开，正在重连… (第 ${streamRetryCount} 次)`
            : "连接已关闭，请刷新页面重试"}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">

          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className={cn("mb-4 flex h-16 w-16 items-center justify-center rounded-2xl", color, "bg-opacity-15")}>
                <Bot className={cn("h-8 w-8", color.replace("bg-", "text-"))} />
              </div>
              <p className="text-lg font-medium text-gray-400">{agentName}</p>
              <p className="mt-1 text-sm text-gray-600">
                {agent?.description ?? "开始与 Agent 对话"}
              </p>
            </div>
          )}

          <MessageList
            messages={messages}
            streamingText={streamingText}
            thinkingText={thinkingText}
            activeTools={activeTools}
            isStreaming={isStreaming}
            agentColorIdx={colorIdx}
            bottomRef={bottomRef}
          />
        </div>
      </main>

      {/* Input */}
      <footer className="flex-shrink-0 border-t border-gray-800 bg-gray-950 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-2xl">
          <InputBar
            onSend={handleSend}
            isStreaming={isStreaming}
          />
        </div>
      </footer>
    </div>
  );
}
