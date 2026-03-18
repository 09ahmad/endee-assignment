"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedText = embedText;
exports.embedBatch = embedBatch;
exports.chunkText = chunkText;
const generative_ai_1 = require("@google/generative-ai");
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
const EMBEDDING_MODEL = "gemini-embedding-001";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
// ── Embed a single string ─────────────────────────────────────
async function embedText(text) {
    const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text.trim());
    const embedding = result.embedding?.values;
    if (!embedding)
        throw new Error("No embedding returned from Gemini.");
    return embedding;
}
// ── Embed multiple strings in one API call ────────────────────
async function embedBatch(texts) {
    const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
    // Gemini doesn't have a true batch endpoint — run in parallel
    const results = await Promise.all(texts.map((t) => model.embedContent(t.trim())));
    return results.map((r, i) => {
        const embedding = r.embedding?.values;
        if (!embedding)
            throw new Error(`Missing embedding at index ${i}`);
        return embedding;
    });
}
// ── Split a document into overlapping chunks ──────────────────
function chunkText(rawText, source) {
    const chunks = [];
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
        }
        else {
            current += (current ? " " : "") + sentence;
        }
    }
    if (current.trim()) {
        chunks.push({ text: current.trim(), source, chunkIndex: index });
    }
    return chunks;
}
//# sourceMappingURL=embedder.js.map