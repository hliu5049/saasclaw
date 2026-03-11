// ── Qdrant HTTP client (no SDK — plain fetch) ──────────────────────────────

const QDRANT_URL = (process.env.QDRANT_URL ?? "http://localhost:6333").replace(/\/$/, "");
const COLLECTION = "agents";
const VECTOR_SIZE = 1536;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function qFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qdrant ${init?.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface QdrantPoint {
  /** Must be a UUID v4 string or a non-negative integer (Qdrant requirement). */
  id: string;
  vector: number[];         // 1536-dim
  payload: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Ensure the "agents" collection exists with 1536-dim Cosine distance.
 * Safe to call on every startup — no-ops if already present.
 */
export async function ensureCollection(): Promise<void> {
  // Check whether the collection already exists
  try {
    await qFetch(`/collections/${COLLECTION}`);
    return; // already exists
  } catch {
    // 404 → create it
  }

  await qFetch(`/collections/${COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
      // Optimise for keyword-based payload filtering (namespace)
      optimizers_config: { default_segment_number: 2 },
    }),
  });
}

/**
 * Upsert a batch of points.
 * Points with the same id are overwritten.
 */
export async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  if (points.length === 0) return;

  await qFetch(`/collections/${COLLECTION}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });
}

/**
 * Semantic search within a specific agent namespace.
 * @param vector   Query embedding (1536-dim)
 * @param namespace  Payload filter value, e.g. "agent-{agentId}"
 * @param topK     Max results (default 5)
 */
export async function search(
  vector: number[],
  namespace: string,
  topK = 5,
): Promise<SearchResult[]> {
  const data = (await qFetch(`/collections/${COLLECTION}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit: topK,
      with_payload: true,
      filter: {
        must: [{ key: "namespace", match: { value: namespace } }],
      },
    }),
  })) as { result: SearchResult[] };

  return data.result;
}

/**
 * Delete all points whose payload matches the given namespace + docId.
 * Used when a document is deleted or re-ingested.
 */
export async function deleteByDocId(namespace: string, docId: string): Promise<void> {
  await qFetch(`/collections/${COLLECTION}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        must: [
          { key: "namespace", match: { value: namespace } },
          { key: "docId",     match: { value: docId } },
        ],
      },
    }),
  });
}
