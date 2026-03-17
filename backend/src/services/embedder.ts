import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

// ── Embed a single string ─────────────────────────────────────
export async function embedText(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: MODEL,
    input: text.trim(),
  });

  const embedding = res.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned from OpenAI.");
  return embedding;
}

// ── Embed multiple strings in one API call ────────────────────
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await getOpenAI().embeddings.create({
    model: MODEL,
    input: texts.map((t) => t.trim()),
  });

  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => {
      if (!d.embedding) throw new Error(`Missing embedding at index ${d.index}`);
      return d.embedding;
    });
}

// ── Types ─────────────────────────────────────────────────────
export interface TextChunk {
  text: string;
  source: string;
  chunkIndex: number;
}

// ── Split a document into overlapping chunks ──────────────────
export function chunkText(rawText: string, source: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  const cleaned = rawText.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/);

  let current = "";
  let index = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
      chunks.push({ text: current.trim(), source, chunkIndex: index++ });

      const words = current.split(" ");
      current =
        words.slice(-Math.floor(CHUNK_OVERLAP / 5)).join(" ") +
        " " +
        sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), source, chunkIndex: index });
  }

  return chunks;
}