"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, BookOpen, Loader2, Send, User } from "lucide-react";

type HistoryEntry = { role: "user" | "assistant"; content: string };

type SourceCitation = {
  text: string;
  source: string;
  similarity: number;
};

type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  hasContext?: boolean;
  sources?: SourceCitation[];
  showSources?: boolean;
};

const WELCOME_MESSAGE =
  "Hello! Start by uploading documents via Upload Docs, then ask questions about your content. The bot will search Endee vector store and answer using Gemini context.";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      hasContext: false,
      sources: [],
      showSources: false,
    },
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const history = useMemo<HistoryEntry[]>(() => {
    return messages
      .filter((msg) => msg.id !== "welcome" && !msg.loading)
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({ role: msg.role, content: msg.content }));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitQuestion = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const loadingMessage: ChatMessageItem = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "Searching Endee & generating answer...",
      loading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setQuestion("");
    setErrorMessage(null);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.message || data.error || "Chat request failed.");
      }

      const answerMessage: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer || "I could not generate an answer.",
        hasContext: !!data.hasContext,
        sources: Array.isArray(data.sources) ? data.sources : [],
        showSources: false,
      };

      setMessages((prev) => prev.filter((m) => !m.loading).concat(answerMessage));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown chat error";
      setErrorMessage(message);
      setMessages((prev) =>
        prev
          .filter((m) => !m.loading)
          .concat({
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${message}`,
            hasContext: false,
            sources: [],
          }),
      );
    } finally {
      setLoading(false);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQuestion();
    }
  };

  const toggleSourcePanel = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, showSources: (msg.hasContext && !msg.showSources) ?? false }
          : msg,
      ),
    );
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-indigo-600" />
          <div>
            <div className="text-lg font-bold text-slate-900">RAG Chatbot</div>
            <p className="text-xs text-slate-500">Powered by Endee Vector DB</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/upload")}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Upload Docs
        </button>
      </header>

      <main className="relative flex flex-1 flex-col p-4">
        {errorMessage && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pr-2">
          {messages.map((msg) => {
            const isAssistant = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`mb-3 flex ${isAssistant ? "justify-start" : "justify-end"}`}
              >
                <div className="flex items-start gap-2 max-w-[85%]">
                  <div className="mt-1">
                    {isAssistant ? (
                      <Bot className="h-5 w-5 text-indigo-500" />
                    ) : (
                      <User className="h-5 w-5 text-slate-700" />
                    )}
                  </div>
                  <div
                    className={`rounded-xl p-3 text-sm shadow-sm ${
                      isAssistant
                        ? "border border-slate-200 bg-white text-slate-900"
                        : "bg-indigo-600 text-white"
                    }`}
                  >
                    {msg.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching Endee & generating answer...</span>
                      </div>
                    ) : (
                      <div>{msg.content}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {messages
          .filter((m) => m.role === "assistant" && m.hasContext && m.sources && m.sources.length > 0)
          .map((assistantItem) => (
            <div key={`${assistantItem.id}-sources`} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSourcePanel(assistantItem.id)}
                className="flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
              >
                <BookOpen className="h-4 w-4" />
                {assistantItem.sources?.length ?? 0} sources from Endee
              </button>
              {assistantItem.showSources && (
                <div className="mt-2 space-y-2">
                  {assistantItem.sources?.map((source, index) => (
                    <div
                      key={`${assistantItem.id}-source-${index}`}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>{source.source}</span>
                        <span>{Math.round(source.similarity * 100)}% match</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {source.text.slice(0, 200)}{source.text.length > 200 ? "..." : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </main>

      <footer className="border-t border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Ask a question about your documents..."
            disabled={loading}
            rows={1}
            className="min-h-[44px] w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={submitQuestion}
            disabled={!question.trim() || loading}
            className="flex h-12 w-14 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
