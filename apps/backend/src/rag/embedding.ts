// ── OpenAI text-embedding-3-small (1536-dim) ──────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_URL   = "https://api.openai.com/v1/embeddings";
const BATCH_SIZE      = 64;   // OpenAI allows up to 2048 inputs per request

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function fetchEmbeddings(inputs: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: inputs, model: EMBEDDING_MODEL }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${res.status}: ${body}`);
  }

  const json = (await res.json()) as EmbeddingResponse;

  // API returns items in the same order as the input array
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Embed a single text string.
 * Returns a 1536-dimensional float array.
 */
export async function embed(text: string): Promise<number[]> {
  const [vector] = await fetchEmbeddings([text]);
  return vector;
}

/**
 * Embed multiple texts in batches of 64.
 * Preserves input order in the returned array.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const vecs  = await fetchEmbeddings(slice);
    results.push(...vecs);
  }

  return results;
}
