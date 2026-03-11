import { EventEmitter } from "node:events";
import WebSocket from "ws";
import nacl from "tweetnacl";

// ── Wire types ─────────────────────────────────────────────────────────────

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
  error?: { code: number; message: string };
}

interface GatewayEvent {
  type: "event";
  event: string;
  payload: unknown;
}

type WireMessage = RpcRequest | RpcResponse | GatewayEvent;

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
  /** Gateway ID stored in DB, used to build deviceId */
  gatewayId: string;
  /** Gateway auth token (optional) */
  token?: string;
  /** RPC timeout in ms, defaults to 30_000 */
  rpcTimeout?: number;
  /** Reconnect delay in ms, defaults to 5_000 */
  reconnectDelay?: number;
}

// ── GatewayClient ──────────────────────────────────────────────────────────

export class GatewayClient extends EventEmitter {
  private readonly url: string;
  private readonly deviceId: string;
  private readonly token: string | undefined;
  private readonly rpcTimeout: number;
  private readonly reconnectDelay: number;

  /** Stable Ed25519 keypair for this instance (regenerated on construction) */
  private readonly keyPair: nacl.SignKeyPair;

  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: GatewayClientOptions) {
    super();
    this.url = opts.url ?? "ws://127.0.0.1:18789";
    this.deviceId = `enterprise-backend-${opts.gatewayId}`;
    this.token = opts.token;
    this.rpcTimeout = opts.rpcTimeout ?? 30_000;
    this.reconnectDelay = opts.reconnectDelay ?? 5_000;
    this.keyPair = nacl.sign.keyPair();
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

  chatSend(
    agentId: string,
    sessionKey: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.call("chat.send", { agentId, sessionKey, message, ...extra });
  }

  chatHistory(
    agentId: string,
    sessionKey: string,
    opts: { limit?: number; before?: string } = {},
  ) {
    return this.call("chat.history", { agentId, sessionKey, ...opts });
  }

  configPatch(agentId: string, patch: Record<string, unknown>) {
    return this.call("config.patch", { agentId, patch });
  }

  configGet(agentId: string) {
    return this.call("config.get", { agentId });
  }

  // ── Socket lifecycle ───────────────────────────────────────────────────

  private _openSocket(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on("open", () => this._onOpen());
    ws.on("message", (data) => this._onMessage(data));
    ws.on("close", () => this._onClose());
    ws.on("error", (err) => {
      this.emit("error", err);
      // close event will fire after error, triggering reconnect
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
  }

  // ── Handshake ──────────────────────────────────────────────────────────

  private _onOpen(): void {
    this.emit("connected");
    const challenge = `${this.deviceId}:${Date.now()}`;
    const challengeBytes = new TextEncoder().encode(challenge);
    const signatureBytes = nacl.sign.detached(challengeBytes, this.keyPair.secretKey);
    const signature = Buffer.from(signatureBytes).toString("base64");
    const publicKey = Buffer.from(this.keyPair.publicKey).toString("base64");

    const params: Record<string, unknown> = {
      deviceId: this.deviceId,
      challenge,
      signature,
      publicKey,
    };
    if (this.token) params.token = this.token;

    this._send({ type: "req", id: this._nextId(), method: "connect", params });
  }

  // ── Message dispatch ───────────────────────────────────────────────────

  private _onMessage(raw: WebSocket.RawData): void {
    let msg: WireMessage;
    try {
      msg = JSON.parse(raw.toString()) as WireMessage;
    } catch {
      return; // ignore malformed frames
    }

    if (msg.type === "res") {
      this._handleResponse(msg);
    } else if (msg.type === "event" && msg.event === "agent") {
      this.emit("agent-event", msg.payload);
    }
  }

  private _handleResponse(msg: RpcResponse): void {
    const entry = this.pending.get(msg.id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(msg.id);

    if (msg.error) {
      entry.reject(
        Object.assign(new Error(msg.error.message), { code: msg.error.code }),
      );
    } else {
      entry.resolve(msg.result);
    }
  }

  // ── Reconnect ──────────────────────────────────────────────────────────

  private _onClose(): void {
    this.ws = null;
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
      this.ws.send(JSON.stringify(msg));
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
