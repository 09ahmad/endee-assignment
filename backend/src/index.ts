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

async function start() {
  console.log("Connecting to Endee...");
  await ensureIndex(); // creates the index if it doesn't exist

  app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
  });
}

start();
