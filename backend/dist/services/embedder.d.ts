export declare function embedText(text: string): Promise<number[]>;
export declare function embedBatch(texts: string[]): Promise<number[][]>;
export interface TextChunk {
    text: string;
    source: string;
    chunkIndex: number;
}
export declare function chunkText(rawText: string, source: string): TextChunk[];
//# sourceMappingURL=embedder.d.ts.map