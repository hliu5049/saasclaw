import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import type { JwtPayload } from "../auth/routes";
import prisma from "../lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a skill name to a safe filename stem, e.g. "Web Search" → "web-search" */
function skillFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve the agent, enforcing ownership (MEMBER = own, ADMIN = all). */
async function resolveAgent(agentId: string, payload: JwtPayload) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status === "DELETED") return null;
  if (payload.role !== "ADMIN" && agent.ownerId !== payload.sub) return null;
  return agent;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function skillRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // ── GET /api/skills ───────────────────────────────────────────────────────
  // Public registry — any authenticated user can browse available skills.

  app.get(
    "/api/skills",
    auth,
    async (): Promise<ApiResponse> => {
      const skills = await prisma.skill.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true, icon: true, version: true, createdAt: true },
      });
      return { success: true, data: { skills } };
    },
  );

  // ── POST /api/skills ──────────────────────────────────────────────────────
  // Register a new skill — ADMIN only.

  app.post<{
    Body: { name: string; description?: string; skillMd: string; icon?: string; version?: string };
  }>(
    "/api/skills",
    {
      ...auth,
      schema: {
        body: {
          type: "object",
          required: ["name", "skillMd"],
          properties: {
            name:        { type: "string", minLength: 1 },
            description: { type: "string" },
            skillMd:     { type: "string", minLength: 1 },
            icon:        { type: "string" },
            version:     { type: "string" },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { role } = req.user as JwtPayload;
      if (role !== "ADMIN") {
        return reply.status(403).send({ success: false, error: "Admin only" });
      }

      const { name, description, skillMd, icon, version } = req.body;

      const skill = await prisma.skill.create({
        data: { name, description, skillMd, icon, version: version ?? "1.0.0" },
      });

      return reply.status(201).send({ success: true, data: { skill } });
    },
  );

  // ── POST /api/agents/:id/skills ───────────────────────────────────────────
  // Bind a skill to an agent and write its skillMd to the workspace.

  app.post<{
    Params: { id: string };
    Body:   { skillId: string; config?: Record<string, unknown> };
  }>(
    "/api/agents/:id/skills",
    {
      ...auth,
      schema: {
        body: {
          type: "object",
          required: ["skillId"],
          properties: {
            skillId: { type: "string" },
            config:  { type: "object" },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const skill = await prisma.skill.findUnique({ where: { id: req.body.skillId } });
      if (!skill) return reply.status(404).send({ success: false, error: "Skill not found" });

      // Prisma Json fields require Prisma.InputJsonValue
      const cfg: Prisma.InputJsonValue = (req.body.config ?? {}) as Prisma.InputJsonValue;

      // Upsert binding (no-op if already assigned)
      const binding = await prisma.agentSkill.upsert({
        where:  { agentId_skillId: { agentId: agent.id, skillId: skill.id } },
        create: { agentId: agent.id, skillId: skill.id, config: cfg },
        update: { config: cfg },
      });

      // Write skillMd to {workspace}/skills/{safe-name}.md
      if (agent.workspacePath) {
        const skillsDir = path.join(agent.workspacePath, "skills");
        await fs.mkdir(skillsDir, { recursive: true });
        await fs.writeFile(
          path.join(skillsDir, `${skillFilename(skill.name)}.md`),
          skill.skillMd,
          "utf8",
        );
      }

      return reply.status(201).send({ success: true, data: { binding, skill } });
    },
  );

  // ── DELETE /api/agents/:id/skills/:skillId ────────────────────────────────
  // Remove a skill binding and delete the workspace .md file.

  app.delete<{ Params: { id: string; skillId: string } }>(
    "/api/agents/:id/skills/:skillId",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const binding = await prisma.agentSkill.findUnique({
        where:   { agentId_skillId: { agentId: agent.id, skillId: req.params.skillId } },
        include: { skill: true },
      });
      if (!binding) return reply.status(404).send({ success: false, error: "Skill binding not found" });

      // Delete .md from workspace (best-effort)
      if (agent.workspacePath) {
        const mdPath = path.join(
          agent.workspacePath,
          "skills",
          `${skillFilename(binding.skill.name)}.md`,
        );
        await fs.unlink(mdPath).catch(() => { /* file may not exist */ });
      }

      await prisma.agentSkill.delete({
        where: { agentId_skillId: { agentId: agent.id, skillId: req.params.skillId } },
      });

      return { success: true, data: null };
    },
  );

  // ── GET /api/agents/:id/skills ─────────────────────────────────────────────
  // List skills currently bound to an agent.

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/skills",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const bindings = await prisma.agentSkill.findMany({
        where:   { agentId: agent.id },
        include: {
          skill: {
            select: { id: true, name: true, description: true, icon: true, version: true },
          },
        },
      });

      return { success: true, data: { skills: bindings.map((b) => ({ ...b.skill, config: b.config })) } };
    },
  );
}
