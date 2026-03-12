import { EventEmitter } from "node:events";
import WebSocket from "ws";
import nacl from "tweetnacl";

// ── Wire types (OpenClaw native protocol) ───────────────────────────────

interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface RpcResponse {
  type: "res";
  id: string;
  result?: unknown;
  error?: { code: number | string; message: string };
}

interface GatewayEvent {
  type: "event";
  event: string;
  payload: unknown;
}

// ── Pending RPC entry ──────────────────────────────────────────────────

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ── Constructor options ────────────────────────────────────────────────

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

// ── GatewayClient (OpenClaw native protocol) ────────────────────────────

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
  private _challengeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly keyPair: nacl.SignKeyPair;
  private readonly deviceId: string;

  constructor(opts: GatewayClientOptions) {
    super();
    this.url = opts.url ?? "ws://127.0.0.1:18789";
    this.token = opts.token;
    this.rpcTimeout = opts.rpcTimeout ?? 30_000;
    this.reconnectDelay = opts.reconnectDelay ?? 5_000;
    this.keyPair = nacl.sign.keyPair();
    this.deviceId = `enterprise-backend-${Date.now()}`;
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

  /** Low-level RPC call */
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

      this._send({ type: "req", id, method, params });
    });
  }

  // ── Business methods ───────────────────────────────────────────────────

  /** Send a message to an agent */
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

  /** Get chat history */
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
        "User-Agent": "Enterprise-Backend/1.0.0",
        "Origin": "http://localhost",
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
    if (this._challengeTimeout) {
      clearTimeout(this._challengeTimeout);
      this._challengeTimeout = null;
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
    this._rejectAllPending(new Error("WebSocket closed"));
  }

  // ── Authentication ─────────────────────────────────────────────────────

  private _onOpen(): void {
    this.emit("connected");
    console.log("[GatewayClient] WebSocket connected, waiting for challenge...");

    // WebSocket-level ping to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30_000);

    // Wait for connect.challenge event; fallback to direct connect after 5s
    this._challengeTimeout = setTimeout(() => {
      this._challengeTimeout = null;
      console.warn("[GatewayClient] No challenge received within 5s, attempting direct connect...");
      this._sendConnect(undefined);
    }, 5_000);
  }

  /** Send connect RPC with optional nonce from challenge */
  private _sendConnect(nonce: string | undefined): void {
    // Sign the nonce with Ed25519
    const signedAt = Date.now();
    const message = nonce ?? `${this.deviceId}:${signedAt}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = nacl.sign.detached(messageBytes, this.keyPair.secretKey);
    const publicKey = Buffer.from(this.keyPair.publicKey).toString("base64");
    const signature = Buffer.from(signatureBytes).toString("base64");

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "cli",
        version: "1.0.0",
        platform: "linux",
        mode: "cli",
      },
      role: "operator",
      scopes: ["operator.read", "operator.write"],
      caps: [],
      commands: [],
      permissions: {},
      locale: "en-US",
      userAgent: "enterprise-backend/1.0.0",
      device: {
        id: this.deviceId,
        publicKey,
        signature,
        signedAt,
        nonce: nonce ?? "",
      },
    };

    params.auth = { token: this.token ?? "" };

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
      console.log("[GatewayClient] Received:", JSON.stringify(msg).substring(0, 200));
    } catch {
      console.warn("[GatewayClient] Failed to parse:", raw.toString().substring(0, 100));
      return;
    }

    if (msg.type === "res") {
      this._handleResponse(msg as unknown as RpcResponse);
    } else if (msg.type === "event" || ("event" in msg && typeof msg.event === "string")) {
      this._handleEvent(msg as unknown as GatewayEvent);
    }
  }

  private _handleResponse(msg: RpcResponse): void {
    const id = String(msg.id);
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(id);

    if (msg.error) {
      entry.reject(
        Object.assign(new Error(msg.error.message), { code: msg.error.code }),
      );
    } else {
      entry.resolve(msg.result);
    }
  }

  private _handleEvent(msg: GatewayEvent): void {
    const eventName = msg.event ?? (msg as Record<string, unknown>).event;

    if (eventName === "connect.challenge") {
      if (this._challengeTimeout) {
        clearTimeout(this._challengeTimeout);
        this._challengeTimeout = null;
      }
      const nonce = (msg.payload as Record<string, unknown>)?.nonce as string | undefined;
      console.log("[GatewayClient] Received connect.challenge, nonce:", nonce);
      this._sendConnect(nonce);
    } else if (eventName === "agent") {
      this.emit("agent-event", msg.payload);
    } else if (eventName === "tick" || eventName === "heartbeat") {
      // Respond to heartbeat
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "event", event: "pong", payload: { ts: Date.now() } }));
      }
    } else {
      this.emit("event", eventName, msg.payload);
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

  private _send(msg: RpcRequest): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(msg);
      console.log("[GatewayClient] Sending:", payload.substring(0, 200));
      this.ws.send(payload);
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
