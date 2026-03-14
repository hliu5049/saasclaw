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

/** Extract final assistant text from a gateway "done" / "final" event payload. */
function extractFinalText(ev: Record<string, unknown>): string | null {
  // "chat" final event: { state: "final", message: { content: [{ type: "text", text }] } }
  const msg = ev.message as Record<string, unknown> | undefined;
  if (msg) {
    const content = msg.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b.type === "text" || b.text)
        .map((b: any) => b.text ?? "")
        .join("");
    }
  }
  return null;
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
      const session = await prisma.chatSession.upsert({
        where:  { sessionKey: key },
        create: { agentId, userId, channelType: "webchat", sessionKey: key },
        update: { lastActive: new Date() },
      });

      // Save user message to DB
      await prisma.chatMessage.create({
        data: { sessionId: session.id, role: "user", content: req.body.message },
      });

      try {
        await gwClient.agentSend(req.body.message, key);
        return { success: true, data: { sessionKey: key, status: "sent" } };
      } catch (err) {
        const error = err as Error;
        app.log.error(`[Chat] Failed to send message to gateway: ${error.message}`);

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
    async (req): Promise<ApiResponse> => {
      const { sub: userId } = req.user as JwtPayload;
      const { agentId }     = req.params;
      const limit           = Number(req.query.limit ?? 100);

      const key = sessionKey(agentId, userId);
      const session = await prisma.chatSession.findUnique({ where: { sessionKey: key } });
      if (!session) {
        return { success: true, data: { messages: [] } };
      }

      const rows = await prisma.chatMessage.findMany({
        where:   { sessionId: session.id },
        orderBy: { createdAt: "asc" },
        take:    limit,
        select:  { role: true, content: true, createdAt: true },
      });

      return { success: true, data: { messages: rows } };
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

      // Cascade delete will also remove messages
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
      reply.hijack();

      const raw = reply.raw;
      // CORS headers must be set manually after hijack() since Fastify hooks are bypassed
      const origin = req.headers.origin;
      if (origin) {
        raw.setHeader("Access-Control-Allow-Origin", origin);
        raw.setHeader("Access-Control-Allow-Credentials", "true");
      }
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

      // ── Gateway event → SSE frame + persist assistant reply ─────────────
      const pool = GatewayPool.getInstance();

      const handler = (ev: unknown) => {
        if (typeof ev !== "object" || ev === null) return;
        const event = ev as Record<string, unknown>;
        const name  = sseEventName(event);

        // Forward to client
        raw.write(`event: ${name}\ndata: ${JSON.stringify(event)}\n\n`);

        // When the assistant finishes, persist the full reply to DB
        if (name === "done") {
          const text = extractFinalText(event);
          if (text) {
            prisma.chatSession
              .findUnique({ where: { sessionKey: key } })
              .then((session) => {
                if (!session) return;
                return prisma.chatMessage.create({
                  data: { sessionId: session.id, role: "assistant", content: text },
                });
              })
              .catch((err) => console.error("[Chat] Failed to save assistant message:", err));
          }
        }
      };

      pool.subscribe(key, handler);

      // ── Cleanup on client disconnect ──────────────────────────────────────
      const cleanup = () => {
        clearInterval(heartbeat);
        pool.unsubscribe(key, handler);
        raw.end();
      };

      await new Promise<void>((resolve) => {
        req.raw.once("close", () => { cleanup(); resolve(); });
      });
    },
  );
}
