import fs from "node:fs/promises";
import path from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedChunk {
  text: string;
  /** 0-based page or chunk index (best-effort) */
  index: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Split a long text into overlapping chunks.
 * @param text       Full document text
 * @param size       Target chunk size in characters
 * @param overlap    Overlap between consecutive chunks
 */
export function chunkText(
  text: string,
  size = 2048,
  overlap = 256,
): ExtractedChunk[] {
  const chunks: ExtractedChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push({ text: text.slice(start, end).trim(), index });
    if (end >= text.length) break;
    start = end - overlap;
    index++;
  }

  return chunks.filter((c) => c.text.length > 0);
}

// ── Extractor ─────────────────────────────────────────────────────────────────

/**
 * Extract plain text from a file on disk.
 * Supports: .txt  .md  .pdf  .docx
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".txt":
    case ".md":
      return fs.readFile(filePath, "utf8");

    case ".pdf":
      return extractPdf(filePath);

    case ".docx":
      return extractDocx(filePath);

    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function extractPdf(filePath: string): Promise<string> {
  // pdf-parse v2: new PDFParse({ data: Uint8Array }).getText() → TextResult { text: string }
  const { PDFParse } = await import("pdf-parse");
  const buffer = await fs.readFile(filePath);
  // Buffer is a Uint8Array subclass; cast to satisfy the LoadParameters type
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer  = await fs.readFile(filePath);
  const result  = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Convenience: extract text then split into chunks ready for embedding.
 */
export async function extractAndChunk(
  filePath: string,
  chunkSize = 2048,
  chunkOverlap = 256,
): Promise<ExtractedChunk[]> {
  const text = await extractText(filePath);
  return chunkText(text, chunkSize, chunkOverlap);
}
