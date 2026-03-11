import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { extractAndChunk } from "./extractor";
import { embedBatch } from "./embedding";
import { upsertPoints, search as qdrantSearch, deleteByDocId } from "./qdrant";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RagConfig {
  namespace: string;           // e.g. "agent-{agentId}"
  chunkSize?: number;          // default 512
  chunkOverlap?: number;       // default 64
}

export interface SearchResult {
  text: string;
  filename: string;
  score: number;
}

// ── RagService ────────────────────────────────────────────────────────────────

export class RagService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Full ingestion pipeline for one file.
   * Call this from a background task (do NOT await in route handlers).
   *
   * Steps:
   *   1. Write buffer to a temp file (extractor needs a file path)
   *   2. Extract text + split into chunks
   *   3. Embed all chunks in batches
   *   4. Upsert into Qdrant (one point per chunk)
   *   5. Update DB: status → READY, chunkCount
   *   On any error → status → FAILED, errorMsg
   */
  async processDocument(
    docId: string,
    agentId: string,
    buffer: Buffer,
    filename: string,
    ragConfig: RagConfig,
  ): Promise<void> {
    const { namespace, chunkSize = 512, chunkOverlap = 64 } = ragConfig;
    const ext  = path.extname(filename).toLowerCase();
    const tmp  = path.join(os.tmpdir(), `rag-${docId}${ext}`);

    try {
      // ── 1. Write temp file ────────────────────────────────────────────────
      await fs.writeFile(tmp, buffer);

      // ── 2. Extract & chunk ────────────────────────────────────────────────
      const chunks = await extractAndChunk(tmp, chunkSize, chunkOverlap);
      if (chunks.length === 0) throw new Error("No text extracted from document");

      // ── 3. Embed in batches ───────────────────────────────────────────────
      const texts   = chunks.map((c) => c.text);
      const vectors = await embedBatch(texts);

      // ── 4. Upsert into Qdrant ─────────────────────────────────────────────
      const points = chunks.map((chunk, i) => ({
        id: randomUUID(),
        vector: vectors[i],
        payload: {
          namespace,
          docId,
          agentId,
          filename,
          chunkIndex: chunk.index,
          text: chunk.text,
        },
      }));

      await upsertPoints(points);

      // ── 5. Update DB → READY ──────────────────────────────────────────────
      await this.prisma.ragDocument.update({
        where: { id: docId },
        data:  { status: "READY", chunkCount: chunks.length },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.prisma.ragDocument.update({
        where: { id: docId },
        data:  { status: "FAILED", errorMsg },
      }).catch(() => { /* best-effort */ });
    } finally {
      await fs.unlink(tmp).catch(() => { /* ignore if already gone */ });
    }
  }

  /**
   * Semantic search within a namespace.
   * Joins Qdrant results with filename from payload.
   */
  async search(
    query: string,
    namespace: string,
    topK = 5,
  ): Promise<SearchResult[]> {
    const { embed } = await import("./embedding");
    const vector  = await embed(query);
    const hits    = await qdrantSearch(vector, namespace, topK);

    return hits.map((h) => ({
      text:     String(h.payload.text     ?? ""),
      filename: String(h.payload.filename ?? ""),
      score:    h.score,
    }));
  }
}
