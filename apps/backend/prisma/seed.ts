import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Skill definitions ─────────────────────────────────────────────────────────

const SKILLS = [
  {
    name:        "RAG Search",
    description: "Semantic search over the agent's private knowledge base (Qdrant).",
    icon:        "🔍",
    version:     "1.0.0",
    skillMd: `# Skill: RAG Search

Search the agent's knowledge base for information relevant to the user's query.

## When to use
- The user asks a factual question that may be answered by uploaded documents.
- The user refers to internal knowledge, policies, or manuals.

## Invocation
\`\`\`
POST /internal/rag/search
Headers: X-Agent-Id: <agentId>
Body: { "query": "<user question>", "topK": 5 }
\`\`\`

## Response
Returns the top-K most relevant text chunks with: text, filename, score.

## Guidelines
- Always cite the source filename when using retrieved content.
- If no results are returned or scores are low (<0.5), say you don't have that information.
`,
  },
  {
    name:        "Web Search",
    description: "Search the open web and return summarised results.",
    icon:        "🌐",
    version:     "1.0.0",
    skillMd: `# Skill: Web Search

Retrieve up-to-date information from the internet.

## When to use
- The user asks about current events, recent news, or live data.
- The knowledge base does not contain the answer.

## Invocation
This skill is provided by an external MCP server endpoint.
Configure the agent's MCP binding to point to a web-search MCP server.

## Guidelines
- Summarise results concisely; do not dump raw snippets.
- Always include the source URL.
- Prefer authoritative sources (.gov, .edu, established news outlets).
`,
  },
  {
    name:        "Code Runner",
    description: "Execute Python or JavaScript code snippets in a sandboxed environment.",
    icon:        "💻",
    version:     "1.0.0",
    skillMd: `# Skill: Code Runner

Run short code snippets and return stdout/stderr.

## When to use
- The user asks you to calculate, transform data, or verify logic.
- A task is better solved by computation than reasoning alone.

## Supported languages
- Python 3.x
- JavaScript (Node.js 20)

## Guidelines
- Never execute code that reads from the filesystem outside /tmp.
- Always show the code to the user before running it.
- Limit execution time to 30 seconds.
`,
  },
  {
    name:        "Image Generation",
    description: "Generate images from text prompts via a diffusion model.",
    icon:        "🎨",
    version:     "1.0.0",
    skillMd: `# Skill: Image Generation

Create images from natural language descriptions.

## When to use
- The user explicitly requests an image, illustration, or visual.
- A concept is easier to understand visually.

## Invocation
This skill calls an external image-generation API (e.g., DALL-E, Stable Diffusion).

## Guidelines
- Confirm with the user before generating to avoid wasted API calls.
- Refuse requests for harmful, illegal, or NSFW content.
- Describe what you are generating before producing the image.
`,
  },
  {
    name:        "Summary",
    description: "Condense long documents or conversation history into concise summaries.",
    icon:        "📝",
    version:     "1.0.0",
    skillMd: `# Skill: Summary

Produce clear, concise summaries of long text.

## When to use
- The user shares a lengthy document and asks for the key points.
- The conversation context is growing long and needs compression.
- The user asks "what did we discuss?" or "summarise this for me".

## Guidelines
- Use bullet points for structured content; prose for narrative content.
- Preserve all key facts, dates, and figures.
- Aim for ≤20% of the original length unless the user specifies otherwise.
`,
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding skills…");

  for (const skill of SKILLS) {
    const existing = await prisma.skill.findFirst({ where: { name: skill.name } });
    if (existing) {
      await prisma.skill.update({
        where: { id: existing.id },
        data:  { description: skill.description, skillMd: skill.skillMd, version: skill.version },
      });
      console.log(`  ↺  updated  "${skill.name}"`);
    } else {
      await prisma.skill.create({ data: skill });
      console.log(`  ✓  created  "${skill.name}"`);
    }
  }

  console.log(`\nDone — ${SKILLS.length} skills seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
