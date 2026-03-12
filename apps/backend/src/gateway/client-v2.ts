import { EventEmitter } from "node:events";
import WebSocket from "ws";

// ── JSON-RPC 2.0 Wire types (OpenClaw compatible) ─────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  id: string | number;
  ok?: boolean;
  payload?: unknown;
  error?: { code: string; message: string } | null;
}

interface GatewayEvent {
  event: string;
  payload: unknown;
}

type WireMessage = JsonRpcResponse | GatewayEvent;

// ── Pending RPC entry ──────────────────────────────────────────────────────

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ── Constructor options ────────────────────────────────────────────────────

export interface GatewayClientOptions {
  /** Gateway ws URL, defaults to ws://127.0.0.1:18789 */
  url?: string;
  /** Gateway auth token (optional) */
  token?: string;
  /** RPC timeout in ms, defaults to 30_000 */
  rpcTimeout?: number;
  /** Reconnect delay in ms, defaults to 5_000 */
  reconnectDelay?: number;
}

// ── GatewayClient (OpenClaw JSON-RPC 2.0 compatible) ──────────────────────

export class GatewayClientV2 extends EventEmitter {
  private readonly url: string;
  private readonly token: string | undefined;
  private readonly rpcTimeout: number;
  private readonly reconnectDelay: number;

  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: GatewayClientOptions) {
    super();
    this.url = opts.url ?? "ws://127.0.0.1:18789";
    this.token = opts.token;
    this.rpcTimeout = opts.rpcTimeout ?? 30_000;
    this.reconnectDelay = opts.reconnectDelay ?? 5_000;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed) return;
    this._openSocket();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this._closeSocket();
    this._rejectAllPending(new Error("GatewayClient destroyed"));
  }

  /** Low-level JSON-RPC 2.0 call */
  async call<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeout = this.rpcTimeout,
  ): Promise<T> {
    if (!this.authenticated && method !== "connect") {
      throw new Error("Not authenticated - call connect() first");
    }

    // Fail fast if WebSocket is not open
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not connected (method: ${method})`);
    }

    const id = this._nextId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (${timeout}ms)`));
      }, timeout);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this._send({ jsonrpc: "2.0", id, method, params });
    });
  }

  // ── Business methods (OpenClaw compatible) ─────────────────────────────

  /** Send a message to an agent (OpenClaw 'agent' method) */
  async agentSend(
    message: string,
    sessionKey: string,
    runId?: string,
  ): Promise<unknown> {
    return this.call("agent", {
      message,
      sessionKey,
      runId: runId ?? `run-${Date.now()}`,
    });
  }

  /** Get chat history (if supported by gateway) */
  async chatHistory(
    sessionKey: string,
    opts: { limit?: number } = {},
  ): Promise<unknown> {
    return this.call("sessions.history", { sessionKey, ...opts });
  }

  /** Update agent configuration */
  async configPatch(agentId: string, patch: Record<string, unknown>): Promise<unknown> {
    return this.call("config.patch", { agentId, patch });
  }

  /** Get agent configuration */
  async configGet(agentId: string): Promise<unknown> {
    return this.call("config.get", { agentId });
  }

  // ── Socket lifecycle ───────────────────────────────────────────────────

  private _openSocket(): void {
    const ws = new WebSocket(this.url, {
      headers: {
        'User-Agent': 'Enterprise-Backend/1.0.0',
        'Origin': 'http://localhost',
      },
      handshakeTimeout: 10000,
    });
    this.ws = ws;

    ws.on("open", () => this._onOpen());
    ws.on("message", (data) => this._onMessage(data));
    ws.on("close", () => this._onClose());
    ws.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private _closeSocket(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (!this.ws) return;
    this.ws.removeAllListeners();
    try {
      this.ws.terminate();
    } catch {
      // ignore
    }
    this.ws = null;
    this.authenticated = false;
    // Reject all pending RPCs immediately — they will never get a response
    this._rejectAllPending(new Error("WebSocket closed"));
  }

  // ── Authentication (OpenClaw connect method) ───────────────────────────

  private _challengeTimeout: ReturnType<typeof setTimeout> | null = null;

  private _onOpen(): void {
    this.emit("connected");
    console.log("[GatewayClient] WebSocket connected, waiting for challenge...");

    // Start WebSocket-level ping to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30_000);

    // OpenClaw sends connect.challenge first; respond after receiving the nonce.
    // If no challenge arrives within 5s, attempt a direct connect RPC anyway.
    this._challengeTimeout = setTimeout(() => {
      this._challengeTimeout = null;
      console.warn("[GatewayClient] No challenge received within 5s, attempting direct connect...");
      this._sendConnect(undefined);
    }, 5_000);
  }

  /** Send connect RPC with optional nonce from challenge */
  private _sendConnect(nonce: string | undefined): void {
    const params: Record<string, unknown> = {
      role: "control",
      client: {
        name: "Enterprise Backend",
        version: "1.0.0",
        platform: "node",
      },
    };

    if (this.token) {
      params.auth = { token: this.token };
    }

    if (nonce) {
      params.nonce = nonce;
    }

    console.log("[GatewayClient] Sending connect RPC, nonce:", nonce ?? "(none)");

    this.call("connect", params, 10_000)
      .then((result) => {
        console.log("[GatewayClient] Connect successful:", result);
        this.authenticated = true;
        this.emit("authenticated");
      })
      .catch((err) => {
        console.warn("[GatewayClient] Connect failed:", (err as Error).message, "— proceeding anyway");
        this.authenticated = true;
        this.emit("authenticated");
      });
  }

  // ── Message dispatch ───────────────────────────────────────────────────

  private _onMessage(raw: WebSocket.RawData): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      console.log("[GatewayClient] Received message:", JSON.stringify(msg).substring(0, 200));
    } catch {
      console.warn("[GatewayClient] Failed to parse message:", raw.toString().substring(0, 100));
      return; // ignore malformed frames
    }

    // Event frame: { event: "...", payload: ... }
    if ("event" in msg && typeof msg.event === "string") {
      this._handleEvent(msg as unknown as GatewayEvent);
    }
    // JSON-RPC response: { id: ..., ok: ..., payload: ... }
    else if ("id" in msg) {
      this._handleResponse(msg as unknown as JsonRpcResponse);
    }
    // JSON-RPC notification: { jsonrpc: "2.0", method: "...", params: ... } (no id)
    else if ("method" in msg && typeof msg.method === "string") {
      this._handleNotification(msg.method, (msg.params ?? {}) as Record<string, unknown>);
    }
  }

  private _handleResponse(msg: JsonRpcResponse): void {
    // Coerce id to string for consistent Map lookup (gateway may return "1" vs 1)
    const id = String(msg.id);
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(id);

    if (msg.ok === false && msg.error) {
      entry.reject(
        Object.assign(new Error(msg.error.message), { code: msg.error.code }),
      );
    } else if ("result" in msg) {
      // Standard JSON-RPC 2.0 response format: { id, result, error }
      entry.resolve((msg as unknown as Record<string, unknown>).result);
    } else {
      // OpenClaw custom format: { id, ok, payload }
      entry.resolve(msg.payload);
    }
  }

  private _handleEvent(msg: GatewayEvent): void {
    if (msg.event === "connect.challenge") {
      // Gateway sends a nonce; reply with connect RPC including the nonce
      if (this._challengeTimeout) {
        clearTimeout(this._challengeTimeout);
        this._challengeTimeout = null;
      }
      const nonce = (msg.payload as Record<string, unknown>)?.nonce as string | undefined;
      console.log("[GatewayClient] Received connect.challenge, nonce:", nonce);
      this._sendConnect(nonce);
    } else if (msg.event === "agent") {
      this.emit("agent-event", msg.payload);
    } else if (msg.event === "tick" || msg.event === "heartbeat") {
      // Respond to heartbeat to keep connection alive
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: "pong", payload: { ts: Date.now() } }));
      }
    } else {
      this.emit("event", msg.event, msg.payload);
    }
  }

  /** Handle JSON-RPC 2.0 notifications (server → client, no id) */
  private _handleNotification(method: string, params: Record<string, unknown>): void {
    if (method === "agent.event" || method === "agent") {
      this.emit("agent-event", params);
    } else {
      this.emit("event", method, params);
    }
  }

  // ── Reconnect ──────────────────────────────────────────────────────────

  private _onClose(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this._challengeTimeout) {
      clearTimeout(this._challengeTimeout);
      this._challengeTimeout = null;
    }
    this.ws = null;
    this.authenticated = false;
    // Reject all pending RPCs — the old socket is gone
    this._rejectAllPending(new Error("WebSocket disconnected"));
    this.emit("disconnected");

    if (this.destroyed) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.emit("reconnecting");
      this._openSocket();
    }, this.reconnectDelay);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private _send(msg: JsonRpcRequest): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn(`[GatewayClient] _send: WebSocket not open, dropping ${msg.method}`);
    }
  }

  private _nextId(): string {
    return `${Date.now()}-${++this.seq}`;
  }

  private _rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
      this.pending.delete(id);
    }
  }
}
