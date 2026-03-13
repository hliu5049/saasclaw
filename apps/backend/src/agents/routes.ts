import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import type { JwtPayload } from "../auth/routes";
import { AgentService } from "./service";
import { GatewayPool } from "../gateway/pool";
import prisma from "../lib/prisma";

// ── Shared helpers ─────────────────────────────────────────────────────────

const svc = new AgentService(prisma);

/** Verify the requesting user may access the agent (ADMIN = all, MEMBER = own). */
async function ownerGuard(
  agentId: string,
  payload: JwtPayload,
): Promise<ReturnType<typeof prisma.agent.findUnique> extends Promise<infer T> ? T : never> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status === "DELETED") return null as never;
  if (payload.role !== "ADMIN" && agent.ownerId !== payload.sub) return null as never;
  return agent as never;
}

// ── Plugin ────────────────────────────────────────────────────────────────

export default async function agentRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // ── GET /api/agents ──────────────────────────────────────────────────────

  app.get("/api/agents", auth, async (req): Promise<ApiResponse> => {
    const { sub, role } = req.user as JwtPayload;

    const agents = await prisma.agent.findMany({
      where: {
        status: { not: "DELETED" },
        ...(role === "ADMIN" ? {} : { ownerId: sub }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        gateway: { select: { id: true, name: true, status: true } },
        _count: { select: { sessions: true, documents: true, skillBindings: true, mcpBindings: true } },
      },
    });

    return { success: true, data: { agents } };
  });

  // ── POST /api/agents ─────────────────────────────────────────────────────

  app.post<{
    Body: {
      name: string;
      description?: string;
      soulMd?: string;
      agentsMd?: string;
      model?: string;
      colorIdx?: number;
    };
  }>(
    "/api/agents",
    {
      ...auth,
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name:        { type: "string", minLength: 1 },
            description: { type: "string" },
            soulMd:      { type: "string" },
            agentsMd:    { type: "string" },
            model:       { type: "string" },
            colorIdx:    { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;

      const agent = await svc.create({ ...req.body, ownerId: payload.sub });

      return reply.status(201).send({ success: true, data: { agent } });
    },
  );

  // ── GET /api/agents/:id ──────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const check = await ownerGuard(req.params.id, req.user as JwtPayload);
      if (!check) return reply.status(404).send({ success: false, error: "Agent not found" });

      const agent = await prisma.agent.findUnique({
        where:   { id: req.params.id },
        include: {
          gateway: { select: { id: true, name: true, status: true } },
          _count:  { select: { sessions: true, documents: true, skillBindings: true, mcpBindings: true } },
        },
      });

      return { success: true, data: { agent } };
    },
  );

  // ── PATCH /api/agents/:id ────────────────────────────────────────────────

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      soulMd?: string;
      agentsMd?: string;
      model?: string;
      colorIdx?: number;
    };
  }>(
    "/api/agents/:id",
    {
      ...auth,
      schema: {
        body: {
          type: "object",
          properties: {
            name:        { type: "string", minLength: 1 },
            description: { type: "string" },
            soulMd:      { type: "string" },
            agentsMd:    { type: "string" },
            model:       { type: "string" },
            colorIdx:    { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const existing = await ownerGuard(req.params.id, req.user as JwtPayload);
      if (!existing) return reply.status(404).send({ success: false, error: "Agent not found" });

      const { name, description, soulMd, agentsMd, model, colorIdx } = req.body;

      const updated = await prisma.agent.update({
        where: { id: req.params.id },
        data: {
          ...(name        !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(soulMd      !== undefined && { soulMd }),
          ...(agentsMd    !== undefined && { agentsMd }),
          ...(model       !== undefined && { model }),
          ...(colorIdx    !== undefined && { colorIdx }),
        },
      });

      // Push config changes to gateway (non-fatal)
      try {
        const pool = GatewayPool.getInstance();
        const gwClient = pool.get(existing.gatewayId);
        if (gwClient) {
          const patch: Record<string, unknown> = {};
          if (name !== undefined) patch.name = name;
          if (model !== undefined) {
            patch.model = model;
            // Look up API key for the new provider
            const providerName = model.split("/")[0];
            const provider = await prisma.llmProvider.findFirst({
              where: { provider: { equals: providerName, mode: "insensitive" }, enabled: true },
            });
            if (provider) {
              patch.apiKey = provider.apiKey;
              patch.apiBaseUrl = provider.baseUrl;
              patch.apiKeys = { [providerName.toLowerCase()]: provider.apiKey };
            }
          }
          if (soulMd !== undefined) {
            patch.soulMd = soulMd;
            // Also update workspace file
            if (existing.workspacePath) {
              const fs = await import("node:fs/promises");
              const path = await import("node:path");
              await fs.writeFile(path.join(existing.workspacePath, "SOUL.md"), soulMd, "utf8");
            }
          }
          if (agentsMd !== undefined && existing.workspacePath) {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            await fs.writeFile(path.join(existing.workspacePath, "AGENTS.md"), agentsMd, "utf8");
          }
          if (Object.keys(patch).length > 0) {
            await gwClient.configPatch(req.params.id, patch);
          }
        }
      } catch (err) {
        console.warn(`[AgentRoutes] gateway config sync skipped for ${req.params.id}:`, err);
      }

      return { success: true, data: { agent: updated } };
    },
  );

  // ── DELETE /api/agents/:id ───────────────────────────────────────────────

  app.delete<{ Params: { id: string } }>(
    "/api/agents/:id",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const existing = await ownerGuard(req.params.id, req.user as JwtPayload);
      if (!existing) return reply.status(404).send({ success: false, error: "Agent not found" });

      // Soft-delete
      await prisma.agent.update({
        where: { id: req.params.id },
        data: { status: "DELETED" },
      });

      // Decrement gateway counters
      const pool = GatewayPool.getInstance();
      pool.decrAgentCount(existing.gatewayId);
      await prisma.gateway.update({
        where: { id: existing.gatewayId },
        data: { agentCount: { decrement: 1 } },
      });

      return reply.status(200).send({ success: true, data: null });
    },
  );
}
