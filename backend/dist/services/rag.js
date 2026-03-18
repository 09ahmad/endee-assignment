"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragQuery = ragQuery;
const generative_ai_1 = require("@google/generative-ai");
const embedder_1 = require("./embedder");
const endee_1 = require("./endee");
let genAI = null;
function getGenAI() {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey)
            throw new Error("GEMINI_API_KEY is not set.");
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
const SIMILARITY_THRESHOLD = 0.3;
async function ragQuery(question, history = []) {
    try {
        // Step 1 — Embed the question
        const questionVector = await (0, embedder_1.embedText)(question);
        // Step 2 — Search Endee for relevant chunks
        const hits = await (0, endee_1.searchSimilar)(questionVector, 5);
        const relevant = hits.filter((h) => h.similarity >= SIMILARITY_THRESHOLD);
        const hasContext = relevant.length > 0;
        // Step 3 — Build context block from retrieved chunks
        const context = relevant
            .map((h, i) => `[Source ${i + 1} — ${h.source}]\n${h.text}`)
            .join("\n\n");
        // Step 4 — Build system prompt
        const systemPrompt = hasContext
            ? `You are a helpful assistant. Answer the user's question using ONLY the context below.
If the context is insufficient, say so clearly. Cite which source you used.

Context:
${context}`
            : `You are a helpful assistant. No relevant documents were found in the vector database
for this question. Let the user know they should upload relevant documents first,
then answer generally if you can.`;
        // Step 5 — Build chat history for Gemini format
        const geminiHistory = history.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));
        // Step 6 — Call Gemini with history + context
        const model = getGenAI().getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
        });
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(question);
        const answer = result.response.text() || "Sorry, I could not generate a response.";
        // Step 7 — Return answer + source citations
        return {
            answer,
            hasContext,
            sources: relevant.map((h) => ({
                text: h.text.slice(0, 200) + (h.text.length > 200 ? "..." : ""),
                source: h.source,
                similarity: Math.round(h.similarity * 100) / 100,
            })),
        };
    }
    catch (error) {
        console.error("ragQuery failed:", error);
        throw new Error("RAG query failed. " +
            (error instanceof Error ? error.message : "Unknown error"));
    }
}
//# sourceMappingURL=rag.js.map