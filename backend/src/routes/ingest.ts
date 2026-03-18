import type { Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { chunkText, embedBatch } from "../services/embedder";
import { upsertChunks, deleteChunksBySource, DocumentChunk } from "../services/endee";
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only PDF and TXT files are supported."));
  },
});

router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
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
      } else {
        rawText = file.buffer.toString("utf-8");
      }

      if (!rawText.trim()) {
        res.status(400).json({ success: false, message: "Could not extract text from file." });
        return;
      }

      const source = file.originalname;

      // ── Delete old chunks for this file (re-upload support) ───
      try {
        await deleteChunksBySource(source);
      } catch (deleteErr) {
        console.warn(`deleteChunksBySource warning for ${source}:`, deleteErr);
      }

      // ── Chunk → embed → upsert into Endee ────────────────────
      const chunks = chunkText(rawText, source);
      if (!chunks.length) {
        res.status(400).json({ success: false, message: "No chunks generated from file." });
        return;
      }

      const embeddings = await embedBatch(chunks.map((c) => c.text));

      const docChunks: DocumentChunk[] = chunks.map((chunk, i) => {
        const vector = embeddings[i];
        if (!vector) throw new Error(`Missing embedding for chunk ${i}`);
        return {
          id: `${source}-chunk-${uuidv4()}`,
          vector,
          text: chunk.text,
          source: chunk.source,
          chunkIndex: chunk.chunkIndex,
        };
      });

      await upsertChunks(docChunks);

      res.json({
        success: true,
        message: `Ingested "${source}" successfully.`,
        chunks: docChunks.length,
        source,
      });
    } catch (error) {
      console.error("/api/ingest failed:", error);
      res.status(500).json({ success: false, message: "Failed to ingest document." });
    }
  },
);

export default router;