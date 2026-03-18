import type { Request, Response } from "express";
import { Router } from "express";
import { ragQuery, ChatMessage } from "../services/rag";
const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { question, history = [] } = req.body as {
      question: string;
      history?: ChatMessage[];
    };

    if (!question?.trim()) {
      res.status(400).json({ success: false, message: "Question is required." });
      return;
    }

    if (!Array.isArray(history)) {
      res.status(400).json({ success: false, message: "History must be an array." });
      return;
    }

    const normalizedHistory: ChatMessage[] = history
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await ragQuery(question.trim(), normalizedHistory);

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      hasContext: result.hasContext,
    });
  } catch (error) {
    console.error("/api/chat failed:", error);
    res.status(500).json({ success: false, message: "Failed to process chat request." });
  }
});

export default router;
