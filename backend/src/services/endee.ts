import { Endee, Precision } from "endee";

const INDEX_NAME = "rag_documents";
const VECTOR_DIMENSION = 3072;

let client: Endee | null = null;

// ── Singleton client ──────────────────────────────────────────
function getClient(): Endee {
  if (!client) {
    const token = process.env.ENDEE_AUTH_TOKEN || "";
    client = new Endee(token);
    client.setBaseUrl(
      process.env.ENDEE_BASE_URL || "http://localhost:8080/api/v1"
    );
  }
  return client;
}

// ── Create index on startup if it doesn't exist ───────────────
export async function ensureIndex(): Promise<void> {
  const c = getClient();

  try {
    console.log(`Creating Endee index: "${INDEX_NAME}" ...`);
    await c.createIndex({
      name: INDEX_NAME,
      dimension: VECTOR_DIMENSION,
      spaceType: "cosine",
      precision: Precision.FLOAT32,
    });
    console.log(`Index "${INDEX_NAME}" created.`);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("already exists")
    ) {
      console.log(`Index "${INDEX_NAME}" already exists, skipping creation.`);
      return;
    }
    console.error("ensureIndex failed:", error);
    throw error;
  }
}

// ── Types ─────────────────────────────────────────────────────
export interface DocumentChunk {
  id: string;
  vector: number[];
  text: string;
  source: string;
  chunkIndex: number;
}

export interface SearchResult {
  id: string;
  similarity: number;
  text: string;
  source: string;
}

// ── Upsert chunks into Endee ──────────────────────────────────
export async function upsertChunks(chunks: DocumentChunk[]): Promise<void> {
  try {
    const index = await getClient().getIndex(INDEX_NAME);

    await index.upsert(
      chunks.map((c) => ({
        id: c.id,
        vector: c.vector,
        meta: {
          text: c.text,
          source: c.source,
          chunkIndex: c.chunkIndex,
        },
        filter: {
          source: c.source,
        },
      }))
    );

    console.log(`Upserted ${chunks.length} chunks into Endee.`);
  } catch (error) {
    console.error("upsertChunks failed:", error);
    throw error;
  }
}

// ── Semantic search in Endee ──────────────────────────────────
export async function searchSimilar(
  queryVector: number[],
  topK = 5
): Promise<SearchResult[]> {
  try {
    const index = await getClient().getIndex(INDEX_NAME);

    const results = await index.query({
      vector: queryVector,
      topK,
      ef: 128,
      includeVectors: false,
    });

    if (!Array.isArray(results)) return [];

    return results.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      text: (r.meta?.text as string) || "",
      source: (r.meta?.source as string) || "",
    }));
  } catch (error) {
    console.error("searchSimilar failed:", error);
    throw error;
  }
}

// ── Delete all chunks belonging to a specific file ────────────
export async function deleteChunksBySource(source: string): Promise<void> {
  try {
    const index = await getClient().getIndex(INDEX_NAME);
    await index.deleteWithFilter([{ source: { $eq: source } }]);
    console.log(`Deleted chunks for: ${source}`);
  } catch (error) {
    console.error("deleteChunksBySource failed:", error);
    throw error;
  }
}