# 🤖 Endee RAG Chatbot

A  **Retrieval-Augmented Generation (RAG)** chatbot that lets you upload
documents (PDF/TXT) and ask natural language questions about them.

Built with **Node.js + TypeScript** backend, **Next.js** frontend, **Google Gemini** for
embeddings and chat, and **Endee** as the vector database for semantic search.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [System Design](#system-design)
- [How Endee Is Used](#how-endee-is-used)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [Step 1 — Start Endee Vector Database](#step-1--start-endee-vector-database)
  - [Step 2 — Backend Setup](#step-2--backend-setup)
  - [Step 3 — Frontend Setup](#step-3--frontend-setup)
- [Running the Full Stack](#running-the-full-stack)
- [API Reference](#api-reference)
- [Testing the Backend](#testing-the-backend)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## 📌 Project Overview

Upload any PDF or TXT document → the backend chunks and embeds it using Gemini →
embeddings are stored in **Endee vector database** → ask questions in the chat UI →
the backend searches Endee for the most relevant chunks → Gemini generates a grounded
answer with source citations.

---

## 🏗️ System Design
```
┌─────────────────────────────────────────────────────────────┐
│                     User (Browser)                          │
│         Next.js Frontend (localhost:3000)                   │
│   ┌──────────────────┐      ┌──────────────────────────┐   │
│   │   Upload Page    │      │       Chat Page          │   │
│   │  (PDF / TXT)     │      │  (Question + History)    │   │
│   └────────┬─────────┘      └────────────┬─────────────┘   │
└────────────┼───────────────────────────-─┼─────────────────┘
             │ POST /api/ingest             │ POST /api/chat
             ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Node.js + Express Backend (localhost:3001)      │
│                                                              │
│  INGEST PIPELINE:               RAG PIPELINE:               │
│  1. Parse PDF / TXT             1. Embed question (Gemini)  │
│  2. Chunk text (500 chars)      2. Search Endee (top 5)     │
│  3. Embed chunks (Gemini)       3. Build context prompt     │
│  4. Upsert into Endee           4. Call Gemini chat model   │
│                                 5. Return answer + sources  │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
         upsert vectors              query vectors
               │                           │
               ▼                           ▼
     ┌───────────────────────────────────────┐
     │        Endee Vector Database          │
     │        (localhost:8080)               │
     │   Index: rag_documents               │
     │   Dimension: 3072 (Gemini)           │
     │   Space: cosine  Precision: FLOAT32  │
     └───────────────────────────────────────┘
               │
     ┌─────────────────────┐
     │   Google Gemini API │
     │  gemini-embedding-001  (embeddings)  │
     │  gemini-2.0-flash      (chat)        │
     └─────────────────────┘
```

### Document Ingestion Flow (`POST /api/ingest`)

1. File uploaded as `multipart/form-data` (PDF or TXT, max 10MB)
2. Text extracted — `pdf-parse` for PDF, UTF-8 decode for TXT
3. Text split into overlapping chunks (500 chars, 50 char overlap)
4. All chunks embedded in parallel using `gemini-embedding-001` (3072 dimensions)
5. Vectors upserted into Endee with metadata `{ text, source, chunkIndex }`
6. Old chunks for same filename deleted before re-ingesting (re-upload support)

### RAG Chat Flow (`POST /api/chat`)

1. User question embedded using `gemini-embedding-001`
2. Endee queried for top 5 most similar chunks (cosine similarity, ef=128)
3. Chunks with similarity ≥ 0.3 used as context
4. System prompt built with retrieved context
5. `gemini-2.0-flash` generates a grounded answer citing sources
6. Response returned with `answer`, `sources`, `hasContext`

---

## 🧠 How Endee Is Used

Endee is the **core of the RAG pipeline**. Every vector operation goes through it:

| Operation | Endee SDK Call | When |
|---|---|---|
| Create index | `client.createIndex()` | On backend startup |
| Store chunks | `index.upsert()` | After document upload |
| Semantic search | `index.query()` | On every chat question |
| Delete old chunks | `index.deleteWithFilter()` | On re-upload of same file |

Each vector stored in Endee:
```json
{
  "id": "filename.pdf-chunk-<uuid>",
  "vector": [3072 floats from Gemini],
  "meta": {
    "text": "chunk text content",
    "source": "filename.pdf",
    "chunkIndex": 0
  },
  "filter": {
    "source": "filename.pdf"
  }
}
```

The `filter.source` field enables deleting all chunks of a specific file
when the same file is re-uploaded.

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Vector Database | **Endee** (`npm install endee`) running via Docker |
| Embeddings | Google Gemini `gemini-embedding-001` (3072 dims) |
| Chat LLM | Google Gemini `gemini-2.0-flash` |
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js 14 + Tailwind CSS |
| File Parsing | `pdf-parse` for PDF, native Buffer for TXT |

---

## ✅ Prerequisites

Before starting make sure you have:

- **Node.js** v18 or higher → [nodejs.org](https://nodejs.org)
- **npm** v9 or higher
- **Docker** → [docs.docker.com/get-docker](https://docs.docker.com/get-docker/)
- **Gemini API key** → [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Verify everything is installed:
```bash
node --version    # should be v18+
npm --version     # should be v9+
docker --version  # any recent version
```

---

## 🚀 Setup Instructions

### Step 1 — Start Endee Vector Database

Endee runs as a Docker container. Start it with:
```bash
docker run -d \
  -p 8080:8080 \
  -v endee-data:/data \
  --name endee-server \
  endeeio/endee-server:latest
```

Verify Endee is running:
```bash
curl http://localhost:8080/api/v1/index/list
```

Expected response:
```json
{"indexes":[]}
```

> **Note:** The `-v endee-data:/data` flag persists your vectors across container restarts.
> Run `docker stop endee-server` to stop and `docker start endee-server` to restart.

---

### Step 2 — Backend Setup

**1. Navigate to backend folder:**
```bash
cd backend
```

**2. Install dependencies:**
```bash
npm install
```

**3. Create `.env` file:**
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
ENDEE_BASE_URL=http://localhost:8080/api/v1
ENDEE_AUTH_TOKEN=
```

> ⚠️ Make sure there are no quotes around values and no spaces around `=`

**4. Build and start the backend:**
```bash
npm run dev
```

You should see:
```
[dotenv@x.x.x] injecting env (4) from .env
Connecting to Endee...
Creating Endee index: "rag_documents" ...
Index "rag_documents" created.
✅ Backend running at http://localhost:3001
```

> If it says `injecting env (0)` your `.env` file is not being found.
> Make sure `.env` is inside the `backend/` folder, not the root.

---

### Step 3 — Frontend Setup

**1. Open a new terminal and navigate to frontend:**
```bash
cd frontend
```

**2. Install dependencies:**
```bash
npm install
```

**3. Start the frontend:**
```bash
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

**4. Open your browser:**
```
http://localhost:3000
```

---

## 🖥️ Running the Full Stack

You need **3 terminals** running simultaneously:

| Terminal | Command | Purpose |
|---|---|---|
| Terminal 1 | `docker start endee-server` | Endee vector DB on port 8080 |
| Terminal 2 | `cd backend && npm run dev` | Express API on port 3001 |
| Terminal 3 | `cd frontend && npm run dev` | Next.js UI on port 3000 |

### How to use the app

1. Open `http://localhost:3000`
2. Click **"Upload Docs"** button
3. Drag and drop a PDF or TXT file
4. Wait for **"X chunks indexed"** confirmation
5. Click **"Go to Chat"**
6. Type a question about your document
7. See the answer with source citations from Endee

---

## 📡 API Reference

### `GET /api/health`
```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

---

### `POST /api/ingest`

Upload a document to be chunked, embedded, and stored in Endee.
```bash
curl -X POST http://localhost:3001/api/ingest \
  -F "file=@/path/to/document.pdf"
```

**Success response:**
```json
{
  "success": true,
  "message": "Ingested \"document.pdf\" successfully.",
  "chunks": 24,
  "source": "document.pdf"
}
```

**Error response:**
```json
{
  "success": false,
  "message": "No file uploaded."
}
```

---

### `POST /api/chat`

Ask a question using RAG over ingested documents.
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is machine learning?",
    "history": []
  }'
```

**Success response:**
```json
{
  "success": true,
  "answer": "Machine learning is a subset of AI...",
  "hasContext": true,
  "sources": [
    {
      "text": "chunk preview text...",
      "source": "document.pdf",
      "similarity": 0.87
    }
  ]
}
```

**With chat history (multi-turn):**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Can you explain that further?",
    "history": [
      { "role": "user", "content": "What is machine learning?" },
      { "role": "assistant", "content": "Machine learning is..." }
    ]
  }'
```

---

## 🧪 Testing the Backend

Run these commands to verify every part is working:
```bash
# 1. Health check
curl http://localhost:3001/api/health

# 2. Create a test file
echo "Machine learning is a subset of AI. Deep learning uses neural networks." > /tmp/test.txt

# 3. Ingest the test file
curl -X POST http://localhost:3001/api/ingest \
  -F "file=@/tmp/test.txt"

# 4. Ask a question (should return hasContext: true)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is machine learning?", "history": []}'

# 5. Ask unrelated question (should return hasContext: false)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the capital of France?", "history": []}'

# 6. Test validation — empty question
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "", "history": []}'

# 7. Test validation — no file
curl -X POST http://localhost:3001/api/ingest
```

---

## 📁 Project Structure
```
endee-chatbot/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   └── routes/
│   │       ├── chat.ts           # POST /api/chat
│   │       └── ingest.ts         # POST /api/ingest
│   ├── services/
│   │   ├── embedder.ts           # Gemini embeddings + text chunking
│   │   ├── endee.ts              # Endee vector DB operations
│   │   └── rag.ts                # RAG pipeline (retrieve → augment → generate)
│   ├── .env                      # Your environment variables (never commit)
│   ├── .env.example              # Template for .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Chat UI
│   │   ├── upload/
│   │   │   └── page.tsx          # Document upload UI
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   └── next.config.js            # Proxies /api/* to backend
│
└── README.md
```

---

## 🔧 Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `injecting env (0)` | `.env` not found | Move `.env` into `backend/` folder |
| `GEMINI_API_KEY is not set` | Key missing from `.env` | Add key to `backend/.env` |
| `Vector dimension mismatch` | Old index has wrong dimensions | Delete index: `docker volume rm endee-data` and restart |
| `404 model not found` | Wrong Gemini model name | Use `gemini-embedding-001` and `gemini-2.0-flash` |
| `port 8080 already allocated` | Old Docker container running | Run `docker ps` then `docker stop <id>` |
| `Failed to ingest document` | Check backend terminal logs | Look for actual error printed above the failure message |
| `hasContext: false` always | No documents ingested yet | Upload a document first via `/upload` page |
| Frontend shows CORS error | Backend not running | Start backend on port 3001 first |

---

## 📝 License

Apache 2.0 — same as the Endee repository this project is built on.