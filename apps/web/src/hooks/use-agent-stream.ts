"use client";

import { useEffect, useRef, useState } from "react";

// ── Public types ──────────────────────────────────────────────────────────────

export type StreamStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

/** Every SSE event type the backend can emit. */
export type SSEEventType =
  | "text"
  | "thinking"
  | "done"
  | "tool_start"
  | "tool_done"
  | "error"
  | "ping";

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export interface UseAgentStreamOptions {
  agentId: string;
  /** Called synchronously in the EventSource listener — keep it fast. */
  onEvent: (event: SSEEvent) => void;
  /** Set to false to disconnect and not reconnect. Defaults to true. */
  enabled?: boolean;
}

export interface UseAgentStreamResult {
  status: StreamStatus;
  /** How many times the stream has reconnected since mount. */
  retryCount: number;
}

// ── Backoff constants ─────────────────────────────────────────────────────────

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS     = 30_000;

function backoffMs(attempt: number): number {
  // 1 s, 2 s, 4 s, 8 s, … capped at 30 s
  return Math.min(INITIAL_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Maintains a persistent SSE connection to `/api/stream/:agentId`.
 * On error it closes the native EventSource (preventing its own retry) and
 * schedules a reconnect with exponential backoff (1 s → 2 s → 4 s → 30 s max).
 */
export function useAgentStream({
  agentId,
  onEvent,
  enabled = true,
}: UseAgentStreamOptions): UseAgentStreamResult {
  const [status, setStatus]     = useState<StreamStatus>("idle");
  const [retryCount, setRetry]  = useState(0);

  // Keep callback ref fresh so callers don't have to memoise it
  const onEventRef = useRef(onEvent);
  useEffect(() => { onEventRef.current = onEvent; });

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled   = false;
    let attempt     = 0;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      es = new EventSource(`/api/stream/${agentId}`);

      // ── open ─────────────────────────────────────────────────────────────
      es.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setRetry(0);
        setStatus("connected");
      };

      // ── named events ─────────────────────────────────────────────────────
      const dispatch = (type: SSEEventType) => (raw: Event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse((raw as MessageEvent).data || "{}") as Record<string, unknown>;
          onEventRef.current({ type, data });
        } catch { /* malformed frame — ignore */ }
      };

      es.addEventListener("text",       dispatch("text"));
      es.addEventListener("thinking",   dispatch("thinking"));
      es.addEventListener("done",       dispatch("done"));
      es.addEventListener("tool_start", dispatch("tool_start"));
      es.addEventListener("ping",       () => { /* heartbeat — no-op */ });

      // tool_done and error arrive as generic "message" events (backend fallback)
      es.addEventListener("message", (raw) => {
        if (cancelled) return;
        try {
          const data = JSON.parse((raw as MessageEvent).data || "{}") as Record<string, unknown>;
          if      (data.type === "tool_done")  onEventRef.current({ type: "tool_done",  data });
          else if (data.type === "error")      onEventRef.current({ type: "error",      data });
        } catch { /* ignore */ }
      });

      // ── error / disconnect ────────────────────────────────────────────────
      es.onerror = () => {
        if (cancelled) return;
        // Close immediately so EventSource doesn't run its own retry logic
        es!.close();
        es = null;

        attempt++;
        setRetry(attempt);

        const delay = backoffMs(attempt);
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (es) { es.close(); es = null; }
      setStatus("closed");
    };
  }, [agentId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, retryCount };
}
