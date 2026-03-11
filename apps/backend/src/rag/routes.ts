import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { ApiResponse } from "@enterprise-openclaw/shared";
import type { JwtPayload } from "../auth/routes";
import prisma from "../lib/prisma";
import { RagService } from "./service";
import { deleteByDocId } from "./qdrant";

// ── Shared ────────────────────────────────────────────────────────────────────

const svc = new RagService(prisma);

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXT = new Set([".txt", ".md", ".pdf", ".docx"]);

/** Return the agent if the requesting user is authorised (owner or ADMIN). */
async function resolveAgent(agentId: string, payload: JwtPayload) {
  const agent = await prisma.agent.findUnique({
    where:   { id: agentId },
    include: { ragConfig: true },
  });
  if (!agent || agent.status === "DELETED") return null;
  if (payload.role !== "ADMIN" && agent.ownerId !== payload.sub) return null;
  return agent;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function ragRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };

  // ── POST /api/rag/:agentId/documents ─────────────────────────────────────
  // Accepts a single file as multipart/form-data; field name: "file"
  // Returns 202 immediately; processing happens in the background.

  app.post<{ Params: { agentId: string } }>(
    "/api/rag/:agentId/documents",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.agentId, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      // Read the uploaded file
      const upload = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } }) // 50 MB
        .catch(() => undefined);

      if (!upload) {
        return reply.status(400).send({ success: false, error: "No file uploaded" });
      }

      const { filename, mimetype } = upload;
      const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

      if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(mimetype)) {
        return reply.status(415).send({
          success: false,
          error:   `Unsupported file type: ${ext} (${mimetype})`,
        });
      }

      // Read the entire buffer before the multipart stream closes
      const buffer = await upload.toBuffer();

      // Create DB record (status = PROCESSING)
      const doc = await prisma.ragDocument.create({
        data: {
          agentId: agent.id,
          filename,
          fileSize: buffer.length,
          mimeType: mimetype,
          status:   "PROCESSING",
        },
      });

      // Determine namespace from ragConfig (fallback to agent-{id})
      const namespace = agent.ragConfig?.namespace ?? `agent-${agent.id}`;
      const ragConfig = {
        namespace,
        chunkSize:    agent.ragConfig?.chunkSize    ?? 512,
        chunkOverlap: agent.ragConfig?.chunkOverlap ?? 64,
      };

      // Fire-and-forget background processing
      setImmediate(() => {
        svc
          .processDocument(doc.id, agent.id, buffer, filename, ragConfig)
          .catch((err) =>
            console.error(`[RagService] processDocument failed for ${doc.id}:`, err),
          );
      });

      return reply.status(202).send({ success: true, data: { doc } });
    },
  );

  // ── GET /api/rag/:agentId/documents ──────────────────────────────────────

  app.get<{ Params: { agentId: string } }>(
    "/api/rag/:agentId/documents",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.agentId, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const docs = await prisma.ragDocument.findMany({
        where:   { agentId: agent.id },
        orderBy: { createdAt: "desc" },
      });

      return { success: true, data: { docs } };
    },
  );

  // ── DELETE /api/rag/:agentId/documents/:docId ─────────────────────────────

  app.delete<{ Params: { agentId: string; docId: string } }>(
    "/api/rag/:agentId/documents/:docId",
    auth,
    async (req, reply): Promise<ApiResponse> => {
      const payload = req.user as JwtPayload;
      const agent   = await resolveAgent(req.params.agentId, payload);
      if (!agent) return reply.status(404).send({ success: false, error: "Agent not found" });

      const doc = await prisma.ragDocument.findUnique({
        where: { id: req.params.docId },
      });
      if (!doc || doc.agentId !== agent.id) {
        return reply.status(404).send({ success: false, error: "Document not found" });
      }

      // Remove vectors from Qdrant
      const namespace = agent.ragConfig?.namespace ?? `agent-${agent.id}`;
      await deleteByDocId(namespace, doc.id).catch((err) =>
        console.warn(`[Qdrant] deleteByDocId failed:`, err),
      );

      // Remove DB record
      await prisma.ragDocument.delete({ where: { id: doc.id } });

      return { success: true, data: null };
    },
  );

  // ── POST /internal/rag/search ─────────────────────────────────────────────
  // Called by the RAG Skill running inside an OpenClaw agent.
  // Auth: X-Agent-Id header must match an active agent.

  app.post<{
    Headers: { "x-agent-id"?: string };
    Body:    { query: string; topK?: number };
  }>(
    "/internal/rag/search",
    {
      schema: {
        body: {
          type:     "object",
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 1 },
            topK:  { type: "integer", minimum: 1, maximum: 20, default: 5 },
          },
        },
      },
    },
    async (req, reply): Promise<ApiResponse> => {
      const agentId = req.headers["x-agent-id"];
      if (!agentId) {
        return reply.status(401).send({ success: false, error: "Missing X-Agent-Id" });
      }

      const agent = await prisma.agent.findUnique({
        where:   { id: agentId },
        include: { ragConfig: true },
      });
      if (!agent || agent.status !== "ACTIVE") {
        return reply.status(403).send({ success: false, error: "Unknown or inactive agent" });
      }

      const namespace = agent.ragConfig?.namespace ?? `agent-${agent.id}`;
      const topK      = req.body.topK ?? 5;

      const results = await svc.search(req.body.query, namespace, topK);

      return { success: true, data: { results } };
    },
  );
}
