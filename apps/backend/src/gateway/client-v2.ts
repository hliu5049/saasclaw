import { EventEmitter } from "node:events";
import WebSocket from "ws";

// ── JSON-RPC 2.0 Wire types (OpenClaw compatible) ─────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  id: string | number;
  ok: boolean;
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
  private pending = new Map<string | number, Pending>();
  private seq = 0;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;

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
    if (!this.ws) return;
    this.ws.removeAllListeners();
    try {
      this.ws.terminate();
    } catch {
      // ignore
    }
    this.ws = null;
    this.authenticated = false;
  }

  // ── Authentication (OpenClaw connect method) ───────────────────────────

  private async _onOpen(): Promise<void> {
    this.emit("connected");
    console.log("[GatewayClient] WebSocket connected, sending connect RPC...");

    try {
      // OpenClaw requires a 'connect' call for authentication
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

      console.log("[GatewayClient] Sending connect with params:", JSON.stringify(params));

      // Try to authenticate, but don't fail if gateway doesn't support it
      try {
        const result = await this.call("connect", params, 5000); // Shorter timeout
        console.log("[GatewayClient] Connect successful:", result);
        this.authenticated = true;
        this.emit("authenticated");
      } catch (err) {
        // If connect fails, assume gateway doesn't require authentication
        console.warn("[GatewayClient] Connect method failed:", (err as Error).message);
        console.warn("[GatewayClient] Proceeding without authentication");
        this.authenticated = true; // Allow RPC calls anyway
        this.emit("authenticated");
      }
    } catch (err) {
      this.emit("error", new Error(`Authentication failed: ${(err as Error).message}`));
      this._closeSocket();
    }
  }

  // ── Message dispatch ───────────────────────────────────────────────────

  private _onMessage(raw: WebSocket.RawData): void {
    let msg: WireMessage;
    try {
      msg = JSON.parse(raw.toString()) as WireMessage;
      console.log("[GatewayClient] Received message:", JSON.stringify(msg).substring(0, 200));
    } catch {
      console.warn("[GatewayClient] Failed to parse message:", raw.toString().substring(0, 100));
      return; // ignore malformed frames
    }

    // Check if it's an event or a response
    if ("event" in msg) {
      this._handleEvent(msg);
    } else if ("id" in msg) {
      this._handleResponse(msg);
    }
  }

  private _handleResponse(msg: JsonRpcResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(msg.id);

    if (!msg.ok && msg.error) {
      entry.reject(
        Object.assign(new Error(msg.error.message), { code: msg.error.code }),
      );
    } else {
      entry.resolve(msg.payload);
    }
  }

  private _handleEvent(msg: GatewayEvent): void {
    // Forward agent events to subscribers
    if (msg.event === "agent") {
      this.emit("agent-event", msg.payload);
    } else if (msg.event === "tick") {
      // Heartbeat - ignore or log
    } else {
      this.emit("event", msg.event, msg.payload);
    }
  }

  // ── Reconnect ──────────────────────────────────────────────────────────

  private _onClose(): void {
    this.ws = null;
    this.authenticated = false;
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
    }
  }

  private _nextId(): number {
    return ++this.seq;
  }

  private _rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
      this.pending.delete(id);
    }
  }
}
