import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRouter from "./routes/chat";
import ingestRouter from "./routes/ingest";
import { ensureIndex } from "./services/endee";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/chat", chatRouter);
app.use("/api/ingest", ingestRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

async function start() {
  try {
    console.log("Connecting to Endee...");
    await ensureIndex().catch((error) => {
      console.warn("Warning: ensureIndex failed, continuing in degraded mode:", error);
    });

    app.listen(PORT, () => {
      console.log(`✅ Backend running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
