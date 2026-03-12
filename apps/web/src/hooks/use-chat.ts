"use client";

import { useState, useCallback, useRef } from "react";
import { useAgentStream, type SSEEvent, type StreamStatus } from "@/hooks/use-agent-stream";

// ── Public types ──────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Populated for assistant messages that included a thinking block. */
  thinking?: string;
  createdAt: Date;
}

export interface ActiveTool {
  /** tool_use_id from the gateway event. */
  id: string;
  name: string;
  input?: Record<string, unknown>;
  startedAt: Date;
}

export interface UseChatOptions {
  agentId: string;
  /** Whether to connect the SSE stream immediately. Default: true. */
  streamEnabled?: boolean;
}

export interface UseChatResult {
  // ── Conversation state ─────────────────────────────────────────────────────
  messages: Message[];
  /** True while the assistant hasn't sent `done` yet. */
  isStreaming: boolean;
  /** Text accumulating in real-time from `text` SSE events. */
  streamingText: string;
  /** Thinking text accumulating from `thinking` SSE events. */
  thinkingText: string;
  /** Tools currently executing (added on tool_start, removed on tool_done). */
  activeTools: ActiveTool[];

  // ── Stream metadata ────────────────────────────────────────────────────────
  streamStatus: StreamStatus;
  streamRetryCount: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  sendMessage: (text: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  resetSession: () => Promise<void>;
}

// ── Normalise raw gateway history entries ─────────────────────────────────────

interface RawMessage {
  role?: string;
  content?: string;
  text?: string;   // some gateways use "text" instead of "content"
  ts?: number;
  timestamp?: string;
  created_at?: string;
}

function normaliseHistory(raw: unknown[]): Message[] {
  return raw.map((m) => {
    const r = m as RawMessage;
    return {
      id:        crypto.randomUUID(),
      role:      (r.role ?? "user") as Message["role"],
      content:   r.content ?? r.text ?? "",
      createdAt: r.ts
        ? new Date(r.ts * 1000)
        : r.timestamp
          ? new Date(r.timestamp)
          : r.created_at
            ? new Date(r.created_at)
            : new Date(),
    };
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat({
  agentId,
  streamEnabled = true,
}: UseChatOptions): UseChatResult {
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [isStreaming,   setIsStreaming]    = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [thinkingText,  setThinkingText]  = useState("");
  const [activeTools,   setActiveTools]   = useState<ActiveTool[]>([]);

  /**
   * Accumulator ref for the current assistant turn.
   * Using a ref (not state) avoids stale-closure issues in the `done` handler.
   */
  const acc = useRef({ text: "", thinking: "" });

  // ── SSE event handler ─────────────────────────────────────────────────────

  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {

      case "text": {
        const chunk = (event.data.text as string) ?? "";
        acc.current.text += chunk;
        setStreamingText(acc.current.text);
        break;
      }

      case "thinking": {
        const chunk = (event.data.text as string) ?? "";
        acc.current.thinking += chunk;
        setThinkingText(acc.current.thinking);
        break;
      }

      case "done": {
        const { text, thinking } = acc.current;
        if (text || thinking) {
          const msg: Message = {
            id:        crypto.randomUUID(),
            role:      "assistant",
            content:   text,
            thinking:  thinking || undefined,
            createdAt: new Date(),
          };
          setMessages(prev => [...prev, msg]);
        }
        acc.current = { text: "", thinking: "" };
        setStreamingText("");
        setThinkingText("");
        setIsStreaming(false);
        setActiveTools([]);
        break;
      }

      case "tool_start": {
        const tool: ActiveTool = {
          id:        (event.data.tool_use_id as string) ?? crypto.randomUUID(),
          name:      (event.data.tool_name  as string) ?? "unknown",
          input:     event.data.input       as Record<string, unknown> | undefined,
          startedAt: new Date(),
        };
        setActiveTools(prev => [...prev, tool]);
        break;
      }

      case "tool_done": {
        const toolId = event.data.tool_use_id as string | undefined;
        if (toolId) {
          setActiveTools(prev => prev.filter(t => t.id !== toolId));
        }
        break;
      }

      case "error": {
        // Gateway-level error: stop streaming; keep whatever text arrived so far
        setIsStreaming(false);
        setActiveTools([]);
        break;
      }

      // "ping" is ignored by use-agent-stream already
    }
  }, []); // stable — acc.current is a mutable ref

  const { status: streamStatus, retryCount: streamRetryCount } = useAgentStream({
    agentId,
    onEvent:  handleEvent,
    enabled:  streamEnabled,
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Optimistically append the user message
    setMessages(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2), role: "user", content: trimmed, createdAt: new Date() },
    ]);

    // Reset accumulator and enter streaming mode before the round-trip
    acc.current = { text: "", thinking: "" };
    setStreamingText("");
    setThinkingText("");
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/proxy/api/chat/${agentId}/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        // Send failed before the gateway even started — bail out
        setIsStreaming(false);
      }
      // On success: the SSE stream will fire events and eventually "done"
    } catch {
      setIsStreaming(false);
    }
  }, [agentId, isStreaming]);

  // ── loadHistory ───────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const res  = await fetch(`/api/proxy/api/chat/${agentId}/history`);
      if (!res.ok) return;
      const data = await res.json() as { success: boolean; data?: { messages: unknown[] } };
      if (!data.success) return;

      const raw = data.data?.messages ?? [];
      setMessages(normaliseHistory(raw));
    } catch { /* network error — keep current state */ }
  }, [agentId]);

  // ── resetSession ──────────────────────────────────────────────────────────

  const resetSession = useCallback(async () => {
    try {
      await fetch(`/api/proxy/api/chat/${agentId}/session`, { method: "DELETE" });
    } catch { /* best-effort */ }

    acc.current = { text: "", thinking: "" };
    setMessages([]);
    setStreamingText("");
    setThinkingText("");
    setIsStreaming(false);
    setActiveTools([]);
  }, [agentId]);

  // ── Result ────────────────────────────────────────────────────────────────

  return {
    messages,
    isStreaming,
    streamingText,
    thinkingText,
    activeTools,
    streamStatus,
    streamRetryCount,
    sendMessage,
    loadHistory,
    resetSession,
  };
}
