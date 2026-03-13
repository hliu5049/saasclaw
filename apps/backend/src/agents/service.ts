import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { GatewayPool } from "../gateway/pool";

// ── Input / output types ───────────────────────────────────────────────────

export interface CreateAgentInput {
  name: string;
  description?: string;
  /** Full SOUL.md text; if omitted a default is generated */
  soulMd?: string;
  /** Initial AGENTS.md memory; defaults to empty */
  agentsMd?: string;
  model?: string;
  colorIdx?: number;
  ownerId: string;
}

// Shape returned by GatewayClient.configGet()
interface ConfigGetResult {
  config: Record<string, unknown>;
  hash: string;
}

// ── Markdown builders ──────────────────────────────────────────────────────

function buildSoulMd(name: string, description: string | undefined): string {
  return `# ${name}

## Identity
${description ?? "An intelligent AI assistant powered by OpenClaw Enterprise."}

## Behavioral Guidelines
- Always respond in the same language the user uses.
- Be concise, accurate, and helpful.
- Respect user privacy and never fabricate information.
- Use the RAG search skill when knowledge base retrieval may help.
- Escalate ambiguous requests by asking clarifying questions.
`.trimStart();
}

function buildIdentityMd(name: string, agentId: string): string {
  return `# Identity

Agent ID : ${agentId}
Name     : ${name}
Platform : OpenClaw Enterprise

This file is read-only. Do not modify it manually.
`.trimStart();
}

function buildRagSearchMd(): string {
  return `# Skill: RAG Search

Trigger this skill when the user asks a question that may be answered
by documents in the knowledge base.

## Usage
\`\`\`
rag_search(query: string, topK?: number = 5)
\`\`\`

Returns the most relevant document chunks ranked by semantic similarity.
This is a placeholder — the actual implementation is provided by the
RAG subsystem at runtime.
`.trimStart();
}

// ── AgentService ───────────────────────────────────────────────────────────

export class AgentService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAgentInput) {
    const {
      name,
      description,
      soulMd,
      agentsMd = "",
      model = "anthropic/claude-opus-4-6",
      colorIdx = 0,
      ownerId,
    } = input;

    // ── Step 1: pick gateway ───────────────────────────────────────────────

    const pool = GatewayPool.getInstance();
    const picked = pool.pickEntryForNewAgent();
    if (!picked) throw new Error("No gateway available");
    const { gatewayId, client } = picked;

    // ── Step 2: create DB records ──────────────────────────────────────────
    // Create Agent + WEBCHAT channel in one transaction, ragConfig separately
    // (needs agentId for the namespace field).

    const agent = await this.prisma.agent.create({
      data: {
        name,
        description,
        soulMd: soulMd ?? buildSoulMd(name, description),
        agentsMd,
        model,
        colorIdx,
        workspacePath: "",   // filled after we know the id
        gatewayId,
        ownerId,
        channels: {
          create: { channelType: "WEBCHAT", enabled: true },
        },
      },
    });

    await this.prisma.agentRag.create({
      data: {
        agentId: agent.id,
        collectionName: "agents",
        namespace: `agent-${agent.id}`,
      },
    });

    // ── Step 3: create workspace directory structure ────────────────────────

    const workspaceRoot =
      process.env.OPENCLAW_WORKSPACE_ROOT ?? "/var/openclaw/workspaces";
    const workspacePath = path.join(workspaceRoot, agent.id);
    const skillsDir = path.join(workspacePath, "skills");

    await fs.mkdir(skillsDir, { recursive: true });

    // ── Step 4: write workspace files ──────────────────────────────────────

    await Promise.all([
      fs.writeFile(
        path.join(workspacePath, "SOUL.md"),
        agent.soulMd,
        "utf8",
      ),
      fs.writeFile(
        path.join(workspacePath, "AGENTS.md"),
        agentsMd,
        "utf8",
      ),
      fs.writeFile(
        path.join(workspacePath, "IDENTITY.md"),
        buildIdentityMd(name, agent.id),
        "utf8",
      ),
      fs.writeFile(
        path.join(skillsDir, "rag-search.md"),
        buildRagSearchMd(),
        "utf8",
      ),
    ]);

    // Persist workspacePath now that the directory exists
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { workspacePath },
    });

    // ── Steps 5-6: push config to gateway (non-fatal if gateway is offline) ──

    try {
      // Look up LLM provider credentials for the agent's model
      const providerName = agent.model.includes("/") ? agent.model.split("/")[0] : "";
      const validProviders = ["ANTHROPIC", "OPENAI", "AZURE_OPENAI", "GOOGLE", "CUSTOM"];
      const provider = providerName && validProviders.includes(providerName.toUpperCase())
        ? await this.prisma.llmProvider.findFirst({
            where: { provider: providerName.toUpperCase() as any, enabled: true },
          })
        : null;

      // Push provider API key + agent model config to gateway (JSON merge semantics)
      const gwConfig: Record<string, unknown> = {
        agents: {
          defaults: {
            model: { primary: agent.model },
          },
        },
      };

      if (provider) {
        gwConfig.models = {
          providers: {
            [providerName.toLowerCase()]: {
              apiKey: provider.apiKey,
              ...(provider.baseUrl && { baseUrl: provider.baseUrl }),
            },
          },
        };
      }

      await client.configPatch(gwConfig);
    } catch (err) {
      // Gateway offline or RPC timeout — agent is persisted, config can be
      // pushed later when the gateway comes back online.
      console.warn(`[AgentService] gateway config push skipped for ${agent.id}:`, err);
    }

    // ── Step 7: update in-memory + DB agentCount ───────────────────────────

    pool.incrAgentCount(gatewayId);

    await this.prisma.gateway.update({
      where: { id: gatewayId },
      data: { agentCount: { increment: 1 } },
    });

    return {
      ...agent,
      workspacePath,
    };
  }
}
