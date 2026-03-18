"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
const embedder_1 = require("../services/embedder");
const endee_1 = require("../services/endee");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ["application/pdf", "text/plain"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only PDF and TXT files are supported."));
    },
});
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "No file uploaded." });
            return;
        }
        const file = req.file;
        let rawText = "";
        // ── Extract raw text ──────────────────────────────────────
        if (file.mimetype === "application/pdf") {
            const parsed = await pdfParse(file.buffer);
            rawText = parsed.text;
        }
        else {
            rawText = file.buffer.toString("utf-8");
        }
        if (!rawText.trim()) {
            res.status(400).json({ success: false, message: "Could not extract text from file." });
            return;
        }
        const source = file.originalname;
        // ── Delete old chunks for this file (re-upload support) ───
        try {
            await (0, endee_1.deleteChunksBySource)(source);
        }
        catch (deleteErr) {
            console.warn(`deleteChunksBySource warning for ${source}:`, deleteErr);
        }
        // ── Chunk → embed → upsert into Endee ────────────────────
        const chunks = (0, embedder_1.chunkText)(rawText, source);
        if (!chunks.length) {
            res.status(400).json({ success: false, message: "No chunks generated from file." });
            return;
        }
        const embeddings = await (0, embedder_1.embedBatch)(chunks.map((c) => c.text));
        const docChunks = chunks.map((chunk, i) => {
            const vector = embeddings[i];
            if (!vector)
                throw new Error(`Missing embedding for chunk ${i}`);
            return {
                id: `${source}-chunk-${(0, uuid_1.v4)()}`,
                vector,
                text: chunk.text,
                source: chunk.source,
                chunkIndex: chunk.chunkIndex,
            };
        });
        await (0, endee_1.upsertChunks)(docChunks);
        res.json({
            success: true,
            message: `Ingested "${source}" successfully.`,
            chunks: docChunks.length,
            source,
        });
    }
    catch (error) {
        console.error("/api/ingest failed:", error);
        res.status(500).json({ success: false, message: "Failed to ingest document." });
    }
});
exports.default = router;
//# sourceMappingURL=ingest.js.map