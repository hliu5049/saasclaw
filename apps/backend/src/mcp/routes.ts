import fs from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import type { JwtPayload } from "../auth/routes";
import prisma from "../lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitise an MCP server name to a safe filename stem. */
function mcpFilename(name: string): string {
  return `mcp-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

/**
 * Generate the Skill Markdown that explains to the Agent how to call
 * this MCP server's tools.
 */
function buildMcpSkillMd(server: {
  name: string;
  description: string | null;
  endpoint: string;
  authType: string;
}, toolsAllowed: string[]): string {
  const toolsSection =
    toolsAllowed.length > 0
      ? toolsAllowed.map((t) => `- \`${t}\``).join("\n")
      : "_(all tools exposed by the server)_";

  const authSection =
    server.authType === "none"
      ? "No authentication required."
      : server.authType === "bearer"
        ? "Send `Authorization: Bearer <token>` with every request (token stored in binding config)."
        : "Use HTTP Basic Auth (credentials stored in binding config).";

  return `# MCP Tool: ${server.name}

${server.description ?? "An external MCP (Model Context Protocol) server."}

## Endpoint
\`\`\`
${server.endpoint}
\`\`\`

## Authentication
${authSection}

## Available Tools
${toolsSection}

## How to call a tool
Send a JSON-RPC 2.0 request to the endpoint above:

\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "<tool-name>",
    "arguments": { "<param>": "<value>" }
  }
}
\`\`\`

To list all available tools first:
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
\`\`\`

## Guidelines
- Only call tools listed in the **Available Tools** section above.
- Always validate that the tool returned a \`result\` before presenting it to the user.
- On error, explain what went wrong and suggest an alternative.
`;
}

/** Resolve agent with ownership guard. */
async function resolveAgent(agentId: string, payload: JwtPayload) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.status === "DELETED") return null;
  if (payload.role !== "ADMIN" && agent.ownerId !== payload.sub) return null;
  return agent;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function mcpRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // ── GET /api/mcp/servers ──────────────────────────────────────────────────

  app.get(
    "/api/mcp/servers",
    auth,
    async (): Promise<ApiResponse> => {
      const servers = await prisma.mcpServer.findMany({
        orderBy: { name: "asc" },
        select:  { id: true, name: true, description: true, endpoint: true, authType: true, icon: true, createdAt: true },
      });
      return { success: true, data: { servers } };
    },
  );

  // ── POST /api/mcp/servers ─────────────────────────────────────────────────

  app.post<{
    Body: { name: string; description?: string; endpoint: string; authType?: string; icon?: string };
  }>(
    "/api/mcp/servers",
    {
      ...auth,
      schema: {
        body: {
          type:     "object",
          required: ["name", "endpoint"],
          properties: {
            name:        { type: "string", minLength: 1 },
            description: { type: "string" },
            endpoint:    { type: "string", minLength: 1 },
            authType:    { type: "string", enum: ["none", "bearer", "basic"] },
            icon:        { type: "string" },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const { role } = req.user as JwtPayload;
      if (role !== "ADMIN") {
        return reply.status(403).send({ success: false, error: "Admin only" });
      }

      const { name, description, endpoint, authType = "none", icon } = req.body;

      const server = await prisma.mcpServer.create({
        data: { name, description, endpoint, authType, icon },
      });

      return reply.status(201).send({ success: true, data: { server } });
    },
  );

  // ── POST /api/agents/:id/mcp ──────────────────────────────────────────────
  // Bind an MCP server to an agent and write the skill .md to workspace.

  app.post<{
    Params: { id: string };
    Body: {
      mcpServerId:  string;
      authConfig?:  Record<string, unknown>;
      toolsAllowed?: string[];
    };
  }>(
    "/api/agents/:id/mcp",
    {
      ...auth,
      schema: {
        body: {
          type:     "object",
          required: ["mcpServerId"],
          properties: {
            mcpServerId:  { type: "string" },
            authConfig:   { type: "object" },
            toolsAllowed: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const server = await prisma.mcpServer.findUnique({ where: { id: req.body.mcpServerId } });
      if (!server) return reply.status(404).send({ success: false, error: "MCP server not found" });

      const authConfig:   Prisma.InputJsonValue = (req.body.authConfig   ?? {}) as Prisma.InputJsonValue;
      const toolsAllowed: Prisma.InputJsonValue = (req.body.toolsAllowed ?? []) as Prisma.InputJsonValue;

      // Upsert binding
      const binding = await prisma.agentMcp.upsert({
        where:  { agentId_mcpServerId: { agentId: agent.id, mcpServerId: server.id } },
        create: { agentId: agent.id, mcpServerId: server.id, authConfig, toolsAllowed },
        update: { authConfig, toolsAllowed },
      });

      // Write MCP skill markdown to workspace/skills/mcp-{name}.md
      if (agent.workspacePath) {
        const skillsDir = path.join(agent.workspacePath, "skills");
        await fs.mkdir(skillsDir, { recursive: true });

        const mdContent = buildMcpSkillMd(
          server,
          (req.body.toolsAllowed ?? []),
        );
        await fs.writeFile(
          path.join(skillsDir, `${mcpFilename(server.name)}.md`),
          mdContent,
          "utf8",
        );
      }

      return reply.status(201).send({ success: true, data: { binding, server } });
    },
  );

  // ── DELETE /api/agents/:id/mcp/:mcpId ────────────────────────────────────

  app.delete<{ Params: { id: string; mcpId: string } }>(
    "/api/agents/:id/mcp/:mcpId",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const binding = await prisma.agentMcp.findUnique({
        where:   { agentId_mcpServerId: { agentId: agent.id, mcpServerId: req.params.mcpId } },
        include: { mcpServer: true },
      });
      if (!binding) return reply.status(404).send({ success: false, error: "MCP binding not found" });

      // Remove workspace skill file (best-effort)
      if (agent.workspacePath) {
        const mdPath = path.join(
          agent.workspacePath,
          "skills",
          `${mcpFilename(binding.mcpServer.name)}.md`,
        );
        await fs.unlink(mdPath).catch(() => { /* ignore */ });
      }

      await prisma.agentMcp.delete({
        where: { agentId_mcpServerId: { agentId: agent.id, mcpServerId: req.params.mcpId } },
      });

      return { success: true, data: null };
    },
  );

  // ── GET /api/agents/:id/mcp ───────────────────────────────────────────────
  // List MCP servers currently bound to an agent.

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/mcp",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.id, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const bindings = await prisma.agentMcp.findMany({
        where:   { agentId: agent.id },
        include: {
          mcpServer: {
            select: { id: true, name: true, description: true, endpoint: true, authType: true, icon: true },
          },
        },
      });

      return {
        success: true,
        data:    {
          mcpServers: bindings.map((b) => ({
            ...b.mcpServer,
            toolsAllowed: b.toolsAllowed,
            // authConfig intentionally omitted from list (may contain credentials)
          })),
        },
      };
    },
  );
}
