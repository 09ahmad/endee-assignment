import OpenAI from "openai";
import { embedText } from "./embedder";
import { searchSimilar } from "./endee";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RAGResult {
  answer: string;
  sources: { text: string; source: string; similarity: number }[];
  hasContext: boolean;
}

const SIMILARITY_THRESHOLD = 0.3;

export async function ragQuery(
  question: string,
  history: ChatMessage[] = [],
): Promise<RAGResult> {

  // Step 1 — Embed the question
  const questionVector = await embedText(question);

  // Step 2 — Search Endee for relevant chunks
  const hits = await searchSimilar(questionVector, 5);
  const relevant = hits.filter((h) => h.similarity >= SIMILARITY_THRESHOLD);
  const hasContext = relevant.length > 0;

  // Step 3 — Build context block from retrieved chunks
  const context = relevant
    .map((h, i) => `[Source ${i + 1} — ${h.source}]\n${h.text}`)
    .join("\n\n");

  // Step 4 — Build system prompt
  const systemPrompt = hasContext
    ? `You are a helpful assistant. Answer the user's question using ONLY the context below.
If the context is insufficient, say so clearly. Cite which source you used.

Context:
${context}`
    : `You are a helpful assistant. No relevant documents were found in the vector database
for this question. Let the user know they should upload relevant documents first,
then answer generally if you can.`;

  // Step 5 — Call GPT with history + context
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
    max_tokens: 1000,
  });

  // Step 6 — Return answer + source citations
  const answer =
    completion.choices[0]?.message.content ||
    "Sorry, I could not generate a response.";

  return {
    answer,
    hasContext,
    sources: relevant.map((h) => ({
      text: h.text.slice(0, 200) + (h.text.length > 200 ? "..." : ""),
      source: h.source,
      similarity: Math.round(h.similarity * 100) / 100,
    })),
  };
}