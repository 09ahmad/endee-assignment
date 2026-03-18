# Endee RAG Chatbot (Gemini)

## Project Overview

This repository is a full-stack RAG chatbot:
- Backend: Node.js + Express + Gemini for embeddings + chat
- Vector store: Endee (via REST API service) stores and searches document embeddings
- Frontend: Next.js app with drag-and-drop upload and chat UI

Use case: upload PDF/TXT files, index them, then ask questions that retrieve context from embeddings and answer via Gemini.

## System Design

### 1. Document Ingestion (`/api/ingest`)
- Upload endpoint accepts `file` (PDF/TXT), max 10MB.
- Text extraction via `pdf-parse` (PDF) or UTF-8 for text.
- Chunking in `backend/src/services/embedder.ts` using overlapped chunks (500 chars, 50 overlap). 
- `embedBatch()` calls Gemini embedding model `gemini-embedding-001`.
- Chunks upserted to Endee vector DB via `backend/src/services/endee.ts`.

### 2. Chat Query (`/api/chat`)
- Input: `{ question, history }`
- Embeds question with Gemini embedding model.
- Searches Endee via `searchSimilar()` (top 5, similarity threshold 0.3).
- If context found, builds user instructions with context block.
- Calls Gemini chat model `gemini-2.5-flash` using `@google/generative-ai` API.
- Response includes: `answer`, `sources`, `hasContext`, `success`.

### 3. Frontend UI
- `frontend/app/upload/page.tsx`: drag/drop, chunk call count, upload state.
- `frontend/app/page.tsx`: chat interface, history building, message list, source toggle.
- Works with the backend endpoints uniform JSON.

## Use of Endee

- Endee stores vector embeddings produced by Gemini.
- Search performed in backend `searchSimilar(questionVector, 5)`.
- RAG chain uses top matching chunks to provide grounded answers and citations.

## Project Setup Instructions

### Prerequisites
- Node.js >=18
- npm
- Gemini API key (set as `GEMINI_API_KEY`)
- Endee API key / connection string (configured in `backend/.env` or environment vars)

### Backend setup

1. `cd backend`
2. `npm install`
3. Create `.env`:
   - `GEMINI_API_KEY=your_key_here`
   - Endee vars as needed (e.g., `ENDEE_API_KEY`, `ENDEE_URL`, etc.)
4. `npm run dev`

### Frontend setup

1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

### Build/Test

- Frontend build: `cd frontend && npm run build`
- Backend start: `cd backend && npm start` (or `npm run dev`)

## Notes

- If no documents are indexed, chat will return context-missing fallback guidance.
- Error messages are handled via `message` field from backend.
- history is preserved as role `user`/`assistant` and passed to backend for improved context.

## Troubleshooting

- **Gemini key missing**: backend throws `GEMINI_API_KEY is not set.`
- **Unsupported file**: upload accepts only PDF/TXT.
- **Large file**: max 10MB per upload.
