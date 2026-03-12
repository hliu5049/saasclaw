import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { GatewayPool } from "../gateway/pool";
import type { JwtPayload } from "../auth/routes";
import { verifySignature } from "./wecom/verify";
import { parseXml, decryptAndParse } from "./wecom/parser";
import { sendWecomText, type WecomChannelConfig } from "./wecom/sender";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load the agent and its WeChat Work channel config from DB. */
async function loadWecomConfig(agentId: string): Promise<{
  agentDbId:  string;
  gatewayId:  string;
  config:     WecomChannelConfig;
} | null> {
  const agent = await prisma.agent.findUnique({
    where:   { id: agentId },
    include: { channels: { where: { channelType: "WECOM", enabled: true } } },
  });

  if (!agent || agent.status === "DELETED") return null;

  // Fall back to env if no channel config row exists yet
  const row        = agent.channels[0];
  const rawConfig  = (row?.channelConfig ?? {}) as Record<string, unknown>;

  const config: WecomChannelConfig = {
    corpId:         String(rawConfig.corpId         ?? process.env.WECOM_CORP_ID         ?? ""),
    corpSecret:     String(rawConfig.corpSecret     ?? process.env.WECOM_CORP_SECRET     ?? ""),
    agentId:        String(rawConfig.agentId        ?? process.env.WECOM_AGENT_ID        ?? ""),
    token:          String(rawConfig.token          ?? process.env.WECOM_TOKEN           ?? ""),
    encodingAESKey: String(rawConfig.encodingAESKey ?? process.env.WECOM_ENCODING_AES_KEY ?? ""),
  };

  if (!config.token || !config.encodingAESKey) return null;

  return { agentDbId: agent.id, gatewayId: agent.gatewayId, config };
}

/**
 * Subscribe to pool events for `sessionKey`, collect all text deltas until
 * "agent_done", then resolve with the full concatenated reply.
 * Times out after `timeoutMs` milliseconds.
 */
function waitForAgentReply(sessionKey: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve) => {
    const pool   = GatewayPool.getInstance();
    const chunks: string[] = [];
    let   timer: ReturnType<typeof setTimeout>;

    const finish = (reason: "done" | "timeout") => {
      clearTimeout(timer);
      pool.unsubscribe(sessionKey, handler);
      const text = chunks.join("").trim();
      if (reason === "timeout" && !text) {
        resolve("(Response timed out)");
      } else {
        resolve(text || "(No response)");
      }
    };

    const handler = (payload: unknown) => {
      if (typeof payload !== "object" || payload === null) return;
      const ev = payload as Record<string, unknown>;

      if (ev.stream === "text" && typeof ev.text === "string") {
        chunks.push(ev.text);
      }
      if (ev.type === "agent_done") {
        finish("done");
      }
    };

    pool.subscribe(sessionKey, handler);
    timer = setTimeout(() => finish("timeout"), timeoutMs);
  });
}

// ── Generic agent resolver (authenticated) ────────────────────────────────────

async function resolveAgent(agentId: string, payload: JwtPayload) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status === "DELETED") return null;
  if (payload.role !== "ADMIN" && agent.ownerId !== payload.sub) return null;
  return agent;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function channelRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // ── GET /api/agents/:id/channels ──────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/channels",
    auth,
    async (req, reply) => {
      const agent = await resolveAgent(req.params.id, req.user as JwtPayload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const channels = await prisma.agentChannel.findMany({ where: { agentId: agent.id } });
      return { success: true, data: { channels } };
    },
  );

  // ── PUT /api/agents/:id/channels/:type ────────────────────────────────────

  const VALID_TYPES = ["WEBCHAT", "WECOM", "DINGTALK", "FEISHU"] as const;
  type ChannelType = typeof VALID_TYPES[number];

  app.put<{
    Params: { id: string; type: string };
    Body:   { channelConfig?: Record<string, unknown>; enabled?: boolean };
  }>(
    "/api/agents/:id/channels/:type",
    {
      ...auth,
      schema: {
        body: {
          type:       "object",
          properties: {
            channelConfig: { type: "object" },
            enabled:       { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const agent = await resolveAgent(req.params.id, req.user as JwtPayload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const channelType = req.params.type.toUpperCase() as ChannelType;
      if (!VALID_TYPES.includes(channelType)) {
        return reply.status(400).send({ success: false, error: "Invalid channel type" });
      }

      const config  = (req.body.channelConfig ?? {}) as Prisma.InputJsonValue;
      const enabled = req.body.enabled ?? true;

      const channel = await prisma.agentChannel.upsert({
        where:  { agentId_channelType: { agentId: agent.id, channelType } },
        create: { agentId: agent.id, channelType, channelConfig: config, enabled },
        update: { channelConfig: config, enabled },
      });

      return { success: true, data: { channel } };
    },
  );


  // WeChat Work sends text/xml bodies; teach Fastify to parse them as strings
  app.addContentTypeParser(
    ["text/xml", "application/xml"],
    { parseAs: "string" },
    (_req, body, done) => done(null, body as string),
  );

  // ── GET /api/channels/webhook/wecom/:agentId  (URL verification) ──────────

  app.get<{
    Params:      { agentId: string };
    Querystring: {
      msg_signature?: string;
      timestamp?:     string;
      nonce?:         string;
      echostr?:       string;
    };
  }>(
    "/api/channels/webhook/wecom/:agentId",
    async (req, reply) => {
      const { agentId }                             = req.params;
      const { msg_signature, timestamp, nonce, echostr } = req.query;

      if (!msg_signature || !timestamp || !nonce || !echostr) {
        return reply.status(400).send("Missing query parameters");
      }

      const ctx = await loadWecomConfig(agentId);
      if (!ctx) return reply.status(404).send("Agent or WeChat Work channel not configured");

      const { token, encodingAESKey } = ctx.config;

      // Verify the 4-param signature (token + timestamp + nonce + echostr)
      const ok = verifySignature({
        token,
        timestamp,
        nonce,
        signature: msg_signature,
        encrypt:   echostr,
      });

      if (!ok) return reply.status(403).send("Invalid signature");

      // Decrypt echostr and return plaintext
      const { decryptMsg } = await import("./wecom/parser");
      const plain = decryptMsg(encodingAESKey, echostr);

      reply.header("Content-Type", "text/plain; charset=utf-8");
      return reply.send(plain);
    },
  );

  // ── POST /api/channels/webhook/wecom/:agentId  (receive messages) ─────────

  app.post<{
    Params:      { agentId: string };
    Querystring: {
      msg_signature?: string;
      timestamp?:     string;
      nonce?:         string;
    };
    Body: string;   // raw XML string, thanks to the content-type parser above
  }>(
    "/api/channels/webhook/wecom/:agentId",
    async (req, reply) => {
      const { agentId }                  = req.params;
      const { msg_signature, timestamp, nonce } = req.query;
      const body                         = req.body as string;

      // ── 1. Validate query params ──────────────────────────────────────────
      if (!msg_signature || !timestamp || !nonce) {
        return reply.status(400).send("Missing query parameters");
      }

      // ── 2. Load channel config ────────────────────────────────────────────
      const ctx = await loadWecomConfig(agentId);
      if (!ctx) {
        // Return "" per WeChat Work protocol (don't expose errors)
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      const { agentDbId, gatewayId, config } = ctx;

      // ── 3. Parse outer XML to get Encrypt field ───────────────────────────
      const outer  = parseXml(body);
      const encrypt = outer.Encrypt;
      if (!encrypt) {
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      // ── 4. Verify signature (4-param: includes Encrypt) ───────────────────
      const sigOk = verifySignature({
        token:     config.token,
        timestamp,
        nonce,
        signature: msg_signature,
        encrypt,
      });

      if (!sigOk) {
        req.log.warn({ agentId }, "WeChat Work: invalid signature");
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      // ── 5. Decrypt inner XML ──────────────────────────────────────────────
      let msg;
      try {
        msg = decryptAndParse(config.encodingAESKey, encrypt);
      } catch (err) {
        req.log.error({ err, agentId }, "WeChat Work: decrypt failed");
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      // ── 6. Only handle text messages ──────────────────────────────────────
      if (msg.MsgType !== "text" || !msg.Content?.trim()) {
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      const fromUser   = msg.FromUserName;
      const userMsg    = msg.Content.trim();
      const sessionKey = `agent:${agentDbId}:wecom:user:${fromUser}`;

      // ── 7. Lookup gateway client ──────────────────────────────────────────
      const pool     = GatewayPool.getInstance();
      const gwClient = pool.get(gatewayId);

      if (!gwClient) {
        req.log.warn({ agentId, gatewayId }, "WeChat Work: gateway unavailable");
        reply.header("Content-Type", "text/plain");
        return reply.send("");
      }

      // ── 8. Return "" immediately (WeChat Work expects < 5 s) ──────────────
      reply.header("Content-Type", "text/plain");
      reply.send("");

      // ── 9. Background: send → wait for reply → push back to user ─────────
      setImmediate(async () => {
        try {
          // Subscribe BEFORE agentSend so we don't miss early events
          const replyPromise = waitForAgentReply(sessionKey, 60_000);

          await gwClient.agentSend(userMsg, sessionKey);

          const replyText = await replyPromise;

          await sendWecomText(config, fromUser, replyText);
          req.log.info({ agentId, fromUser, len: replyText.length }, "WeChat Work: reply sent");
        } catch (err) {
          req.log.error({ err, agentId, fromUser }, "WeChat Work: background reply failed");
        }
      });
    },
  );
}
