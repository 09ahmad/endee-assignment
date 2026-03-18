"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rag_1 = require("../services/rag");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    try {
        const { question, history = [] } = req.body;
        if (!question?.trim()) {
            res.status(400).json({ success: false, message: "Question is required." });
            return;
        }
        if (!Array.isArray(history)) {
            res.status(400).json({ success: false, message: "History must be an array." });
            return;
        }
        const normalizedHistory = history
            .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .map((m) => ({ role: m.role, content: m.content }));
        const result = await (0, rag_1.ragQuery)(question.trim(), normalizedHistory);
        res.json({
            success: true,
            answer: result.answer,
            sources: result.sources,
            hasContext: result.hasContext,
        });
    }
    catch (error) {
        console.error("/api/chat failed:", error);
        res.status(500).json({ success: false, message: "Failed to process chat request." });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map