export declare function ensureIndex(): Promise<void>;
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
export declare function upsertChunks(chunks: DocumentChunk[]): Promise<void>;
export declare function searchSimilar(queryVector: number[], topK?: number): Promise<SearchResult[]>;
export declare function deleteChunksBySource(source: string): Promise<void>;
//# sourceMappingURL=endee.d.ts.map