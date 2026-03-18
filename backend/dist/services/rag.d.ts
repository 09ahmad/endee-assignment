export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}
export interface RAGResult {
    answer: string;
    sources: {
        text: string;
        source: string;
        similarity: number;
    }[];
    hasContext: boolean;
}
export declare function ragQuery(question: string, history?: ChatMessage[]): Promise<RAGResult>;
//# sourceMappingURL=rag.d.ts.map