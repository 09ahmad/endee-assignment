"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const chat_1 = __importDefault(require("./routes/chat"));
const ingest_1 = __importDefault(require("./routes/ingest"));
const endee_1 = require("./services/endee");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({ origin: "http://localhost:3000" }));
app.use(express_1.default.json({ limit: "10mb" }));
app.use("/api/chat", chat_1.default);
app.use("/api/ingest", ingest_1.default);
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
});
async function start() {
    try {
        console.log("Connecting to Endee...");
        await (0, endee_1.ensureIndex)().catch((error) => {
            console.warn("Warning: ensureIndex failed, continuing in degraded mode:", error);
        });
        app.listen(PORT, () => {
            console.log(`✅ Backend running at http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=index.js.map