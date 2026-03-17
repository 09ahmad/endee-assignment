import { Endee, Precision } from "endee";

const INDEX_NAME = "rag_documents";
const VECTOR_DIMENSION = 1536; // OpenAI text-embedding-3-small

let client: Endee | null = null;

// ── Singleton client ──────────────────────────────────────────
function getClient(): Endee {
  if (!client) {
    client = new Endee(process.env.ENDEE_AUTH_TOKEN || "");
    client.setBaseUrl(
      process.env.ENDEE_BASE_URL || "http://localhost:8080/api/v1",
    );
  }
  return client;
}

// ── Create index on startup if it doesn't exist ───────────────
export async function ensureIndex(): Promise<void> {
  const c = getClient();
  const indexes: any = await c.listIndexes();
  const exists = indexes.some((i: any) => i.name === INDEX_NAME);

  if (!exists) {
    console.log(`Creating Endee index: "${INDEX_NAME}" ...`);
    await c.createIndex({
      name: INDEX_NAME,
      dimension: VECTOR_DIMENSION,
      spaceType: "cosine",
      precision: Precision.FLOAT32,
    });
    console.log(`Index "${INDEX_NAME}" created.`);
  } else {
    console.log(`Index "${INDEX_NAME}" already exists.`);
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
        source: c.source, // enables per-file deletion later
      },
    })),
  );

  console.log(`Upserted ${chunks.length} chunks into Endee.`);
}

// ── Semantic search in Endee ──────────────────────────────────
export async function searchSimilar(
  queryVector: number[],
  topK = 5,
): Promise<SearchResult[]> {
  const index = await getClient().getIndex(INDEX_NAME);

  const results = await index.query({
    vector: queryVector,
    topK,
    ef: 128,
    includeVectors: false,
  });

  return results.map((r) => ({
    id: r.id,
    similarity: r.similarity,
    text: (r.meta?.text as string) || "",
    source: (r.meta?.source as string) || "",
  }));
}

// ── Delete all chunks belonging to a specific file ────────────
export async function deleteChunksBySource(source: string): Promise<void> {
  const index = await getClient().getIndex(INDEX_NAME);
  await index.deleteWithFilter([{ source: { $eq: source } }]);
  console.log(`Deleted chunks for: ${source}`);
}
