import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import prisma from "./lib/prisma";
import { GatewayPool } from "./gateway/pool";
import authRoutes, { authenticate } from "./auth/routes";
import agentRoutes from "./agents/routes";
import chatRoutes from "./chat/routes";
import ragRoutes from "./rag/routes";
import skillRoutes from "./skills/routes";
import mcpRoutes from "./mcp/routes";
import channelRoutes from "./channels/routes";
import llmProviderRoutes from "./llm-providers/routes";

const app = Fastify({ logger: true });

const start = async () => {
  // ── Plugins ──────────────────────────────────────────────────────────────
  await app.register(cors);
  await app.register(multipart);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "change-me-in-production",
  });

  // ── Decorators ───────────────────────────────────────────────────────────
  app.decorate("authenticate", authenticate);

  // ── Gateway pool ─────────────────────────────────────────────────────────
  const pool = GatewayPool.getInstance(prisma);
  await pool.init();

  // ── Routes ───────────────────────────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(llmProviderRoutes, { prefix: "/api/llm-providers" });
  await app.register(agentRoutes);
  await app.register(chatRoutes);
  await app.register(ragRoutes);
  await app.register(skillRoutes);
  await app.register(mcpRoutes);
  await app.register(channelRoutes);

  app.get("/health", async (): Promise<ApiResponse> => {
    return { success: true, data: { status: "ok" } };
  });

  // ── Start ────────────────────────────────────────────────────────────────
  try {
    await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
