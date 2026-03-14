import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import type { JwtPayload } from "../auth/routes";
import { GatewayPool } from "../gateway/pool";
import prisma from "../lib/prisma";

// ── Helpers ────────────────────────────────────────────────────────────────

function sessionKey(agentId: string, userId: string): string {
  return `agent:${agentId}:webchat:user:${userId}`;
}

/** Map a raw gateway payload to an SSE event name. */
function sseEventName(ev: Record<string, unknown>): string {
  // "agent" events use stream field
  if (ev.stream === "text")        return "text";
  if (ev.stream === "thinking")    return "thinking";
  if (ev.stream === "assistant")   return "text";
  if (ev.stream === "lifecycle")   return "done";
  if (ev.type   === "agent_done")  return "done";
  if (ev.type   === "tool_start")  return "tool_start";
  // "chat" events use state field
  if (ev.state  === "delta")       return "text";
  if (ev.state  === "final")       return "done";
  return "message";
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default async function chatRoutes(app: FastifyInstance) {

  // ── POST /api/chat/:agentId/send ─────────────────────────────────────────

  app.post<{
    Params: { agentId: string };
    Body: { message: string };
  }>(
    "/api/chat/:agentId/send",
    {
      preHandler: [app.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { sub: userId } = req.user as JwtPayload;
      const { agentId }     = req.params;

      // Resolve agent → gateway
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent || agent.status === "DELETED") {
        return reply.status(404).send({ success: false, error: "Agent not found" });
      }

      const gwClient = GatewayPool.getInstance().get(agent.gatewayId);
      if (!gwClient) {
        return reply.status(503).send({ success: false, error: "Gateway unavailable" });
      }

      const key = sessionKey(agentId, userId);

      // Upsert session record (touch lastActive on repeat calls)
      await prisma.chatSession.upsert({
        where:  { sessionKey: key },
        create: { agentId, userId, channelType: "webchat", sessionKey: key },
        update: { lastActive: new Date() },
      });

      try {
        await gwClient.agentSend(req.body.message, key);
        return { success: true, data: { sessionKey: key, status: "sent" } };
      } catch (err) {
        const error = err as Error;
        app.log.error(`[Chat] Failed to send message to gateway: ${error.message}`);
        
        // Return a more helpful error message
        if (error.message.includes("timeout")) {
          return reply.status(504).send({ 
            success: false, 
            error: "Gateway timeout - the AI agent may not be configured properly or the gateway is overloaded" 
          });
        }
        
        return reply.status(500).send({ 
          success: false, 
          error: "Failed to send message to gateway" 
        });
      }
    },
  );

  // ── GET /api/chat/:agentId/history ──────────────────────────────────────────

  app.get<{ Params: { agentId: string }; Querystring: { limit?: number } }>(
    "/api/chat/:agentId/history",
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<ApiResponse> => {
      const { sub: userId } = req.user as JwtPayload;
      const { agentId }     = req.params;
      const limit           = Number(req.query.limit ?? 100);

      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent || agent.status === "DELETED") {
        return reply.status(404).send({ success: false, error: "Agent not found" });
      }

      const gwClient = GatewayPool.getInstance().get(agent.gatewayId);
      if (!gwClient) {
        return { success: true, data: { messages: [] } }; // gateway down = empty history
      }

      const key = sessionKey(agentId, userId);

      try {
        const result = await gwClient.chatHistory(key, { limit });
        // Normalise to { messages: Array<{ role, content, ts? }> }
        const messages = Array.isArray(result) ? result : (result as { messages?: unknown[] }).messages ?? [];
        return { success: true, data: { messages } };
      } catch {
        return { success: true, data: { messages: [] } };
      }
    },
  );

  // ── DELETE /api/chat/:agentId/session ─────────────────────────────────────

  app.delete<{ Params: { agentId: string } }>(
    "/api/chat/:agentId/session",
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<ApiResponse> => {
      const { sub: userId } = req.user as JwtPayload;
      const { agentId }     = req.params;
      const key             = sessionKey(agentId, userId);

      await prisma.chatSession.deleteMany({ where: { sessionKey: key } });
      return reply.status(200).send({ success: true, data: null });
    },
  );

  // ── GET /api/chat/:agentId/stream  (SSE) ─────────────────────────────────

  app.get<{
    Params:      { agentId: string };
    Querystring: { token?: string };
  }>(
    "/api/chat/:agentId/stream",
    async (req, reply) => {
      const { agentId } = req.params;
      const { token }   = req.query;

      // ── Auth via query token (EventSource cannot set headers) ─────────────
      if (!token) {
        reply.status(401).send({ success: false, error: "Missing token" });
        return;
      }

      let payload: JwtPayload;
      try {
        payload = app.jwt.verify<JwtPayload>(token);
      } catch {
        reply.status(401).send({ success: false, error: "Invalid token" });
        return;
      }

      const key = sessionKey(agentId, payload.sub);

      // ── SSE headers ───────────────────────────────────────────────────────
      // hijack() tells Fastify not to touch reply lifecycle after this point
      reply.hijack();

      const raw = reply.raw;
      raw.setHeader("Content-Type",    "text/event-stream");
      raw.setHeader("Cache-Control",   "no-cache");
      raw.setHeader("X-Accel-Buffering", "no");
      raw.setHeader("Connection",      "keep-alive");
      raw.flushHeaders();

      // Opening comment — establishes the stream in browsers
      raw.write(":\n\n");

      // ── Heartbeat ─────────────────────────────────────────────────────────
      const heartbeat = setInterval(() => {
        raw.write("event: ping\ndata: {}\n\n");
      }, 15_000);

      // ── Gateway event → SSE frame ─────────────────────────────────────────
      const pool    = GatewayPool.getInstance();
      const handler = (ev: unknown) => {
        if (typeof ev !== "object" || ev === null) return;
        const event = ev as Record<string, unknown>;
        const name  = sseEventName(event);
        raw.write(`event: ${name}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      pool.subscribe(key, handler);

      // ── Cleanup on client disconnect ──────────────────────────────────────
      const cleanup = () => {
        clearInterval(heartbeat);
        pool.unsubscribe(key, handler);
        raw.end();
      };

      // Keep the Fastify handler suspended; resolve only when client leaves
      await new Promise<void>((resolve) => {
        req.raw.once("close", () => { cleanup(); resolve(); });
      });
    },
  );
}
