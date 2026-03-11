import type { PrismaClient } from "@prisma/client";
import { GatewayClient } from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentEventCallback = (payload: unknown) => void;

interface GatewayEntry {
  client: GatewayClient;
  /** In-memory mirror of Gateway.agentCount; update via incrAgentCount/decrAgentCount */
  agentCount: number;
}

// ── GatewayPool ────────────────────────────────────────────────────────────

export class GatewayPool {
  private static _instance: GatewayPool | undefined;

  private readonly entries = new Map<string, GatewayEntry>();
  private defaultId: string | null = null;
  /** sessionKey → set of SSE callbacks */
  private readonly subscribers = new Map<string, Set<AgentEventCallback>>();

  private constructor(private readonly prisma: PrismaClient) {}

  // ── Singleton access ───────────────────────────────────────────────────

  /** Call once at startup with a prisma instance; afterwards call without args. */
  static getInstance(prisma?: PrismaClient): GatewayPool {
    if (!GatewayPool._instance) {
      if (!prisma) throw new Error("GatewayPool.getInstance: not initialized – pass prisma on first call");
      GatewayPool._instance = new GatewayPool(prisma);
    }
    return GatewayPool._instance;
  }

  // ── Init ───────────────────────────────────────────────────────────────

  /**
   * Load all gateways from DB and open WebSocket connections.
   * If the gateways table is empty, auto-register the gateway at
   * OPENCLAW_GATEWAY_URL (defaults to ws://127.0.0.1:18789).
   */
  async init(): Promise<void> {
    let rows = await this.prisma.gateway.findMany();

    if (rows.length === 0) {
      const wsUrl = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
      const created = await this.prisma.gateway.create({
        data: { name: "default", wsUrl, status: "ONLINE", agentCount: 0 },
      });
      rows = [created];
    }

    for (const row of rows) {
      this._connectGateway(row);
    }
    this.defaultId = rows[0].id;
  }

  // ── Lookup ─────────────────────────────────────────────────────────────

  /** Return the client for a specific gateway id, or undefined if not found. */
  get(gatewayId: string): GatewayClient | undefined {
    return this.entries.get(gatewayId)?.client;
  }

  /** Return the first-registered (default) gateway client. */
  getDefault(): GatewayClient | undefined {
    if (!this.defaultId) return undefined;
    return this.entries.get(this.defaultId)?.client;
  }

  /**
   * Return the gateway client with the lowest in-memory agentCount.
   * Useful when creating a new agent and you want to load-balance across gateways.
   */
  pickForNewAgent(): GatewayClient | undefined {
    return this.pickEntryForNewAgent()?.client;
  }

  /** Like pickForNewAgent but also returns the gatewayId — needed when creating DB records. */
  pickEntryForNewAgent(): { gatewayId: string; client: GatewayClient } | undefined {
    let bestId: string | undefined;
    let bestEntry: GatewayEntry | undefined;

    for (const [id, entry] of this.entries) {
      if (!bestEntry || entry.agentCount < bestEntry.agentCount) {
        bestId = id;
        bestEntry = entry;
      }
    }

    if (!bestId || !bestEntry) return undefined;
    return { gatewayId: bestId, client: bestEntry.client };
  }

  // ── Agent count tracking ───────────────────────────────────────────────

  /** Call after successfully creating an agent on this gateway. */
  incrAgentCount(gatewayId: string): void {
    const entry = this.entries.get(gatewayId);
    if (entry) entry.agentCount += 1;
  }

  /** Call after deleting an agent from this gateway. */
  decrAgentCount(gatewayId: string): void {
    const entry = this.entries.get(gatewayId);
    if (entry) entry.agentCount = Math.max(0, entry.agentCount - 1);
  }

  // ── SSE subscriptions ──────────────────────────────────────────────────

  /** Subscribe a SSE callback to events for a specific session. */
  subscribe(sessionKey: string, cb: AgentEventCallback): void {
    let set = this.subscribers.get(sessionKey);
    if (!set) {
      set = new Set();
      this.subscribers.set(sessionKey, set);
    }
    set.add(cb);
  }

  /** Unsubscribe a previously registered SSE callback. */
  unsubscribe(sessionKey: string, cb: AgentEventCallback): void {
    const set = this.subscribers.get(sessionKey);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) this.subscribers.delete(sessionKey);
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private _connectGateway(row: {
    id: string;
    wsUrl: string;
    token: string | null;
    agentCount: number;
  }): void {
    const client = new GatewayClient({
      gatewayId: row.id,
      url: row.wsUrl,
      token: row.token ?? undefined,
    });

    // Suppress unhandled-error crashes; reconnect is handled inside GatewayClient
    client.on("error", () => { /* handled by GatewayClient reconnect */ });

    // Forward agent events to the matching session subscribers
    client.on("agent-event", (payload: unknown) => {
      this._dispatch(payload);
    });

    client.connect();

    this.entries.set(row.id, { client, agentCount: row.agentCount });
  }

  /**
   * Route an incoming agent-event payload to subscribers whose sessionKey
   * matches the one embedded in the payload.
   */
  private _dispatch(payload: unknown): void {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("sessionKey" in payload)
    ) {
      return;
    }

    const sessionKey = (payload as Record<string, unknown>).sessionKey;
    if (typeof sessionKey !== "string") return;

    const set = this.subscribers.get(sessionKey);
    if (!set) return;

    for (const cb of set) {
      try {
        cb(payload);
      } catch {
        // don't let one bad subscriber break others
      }
    }
  }
}
