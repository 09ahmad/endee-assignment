import type { Request, Response } from "express";
import { Router } from "express";
import { ragQuery, ChatMessage } from "../services/rag";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { question, history = [] } = req.body as {
    question: string;
    history: ChatMessage[];
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  const result = await ragQuery(question.trim(), history);

  res.json({
    success: true,
    answer: result.answer,
    sources: result.sources,
    hasContext: result.hasContext,
  });
});

export default router;
