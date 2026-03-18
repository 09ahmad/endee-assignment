"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type UploadStatus = "pending" | "uploading" | "success" | "error";

type UploadFileEntry = {
  id: string;
  file: File;
  status: UploadStatus;
  chunks?: number;
  errorMessage?: string;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function UploadPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasSuccessful = useMemo(
    () => files.some((file) => file.status === "success"),
    [files],
  );

  const acceptableMime = ["application/pdf", "text/plain"];

  const processFiles = (selectedFiles: FileList) => {
    const incoming: UploadFileEntry[] = [];

    Array.from(selectedFiles).forEach((file) => {
      if (!acceptableMime.includes(file.type)) return;
      if (file.size > 10 * 1024 * 1024) return;

      const exists = files.some((f) => f.file.name === file.name && f.file.size === file.size);
      if (exists) return;

      incoming.push({
        id: `${file.name}-${file.size}-${Date.now()}`,
        file,
        status: "pending",
      });
    });

    if (incoming.length > 0) {
      setFiles((prev) => [...prev, ...incoming]);
      uploadBatch(incoming);
    }
  };

  const uploadBatch = async (items: UploadFileEntry[]) => {
    for (const item of items) {
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)),
      );

      try {
        const formData = new FormData();
        formData.append("file", item.file);

        const response = await fetch(`${API_BASE}/api/ingest`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || "Upload failed");
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "success",
                  chunks: typeof data.chunks === "number" ? data.chunks : undefined,
                }
              : f,
          ),
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown upload error",
                }
              : f,
          ),
        );
      }
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
    }
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    processFiles(event.target.files);
    event.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">RAG Chatbot</h1>
            <p className="text-xs text-slate-500">Upload documents to vectorize into Endee</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Back to Chat
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-6">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">How it works</h2>
          <ol className="space-y-2 text-sm text-slate-700">
            <li>1. Upload a PDF or TXT file</li>
            <li>2. Backend chunks and embeds it via Gemini</li>
            <li>3. Embeddings stored in Endee Vector Database</li>
            <li>4. Go to Chat and ask questions</li>
          </ol>
        </section>

        <section
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
            dragActive
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-white"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <Upload className="mb-2 h-8 w-8 text-indigo-600" />
          <p className="text-lg font-semibold text-slate-800">Drag &amp; drop files here</p>
          <p className="text-sm text-slate-500">or click to browse</p>
          <p className="mt-2 text-xs text-slate-500">Supports PDF and TXT • Max 10MB</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt"
            onChange={handleFileChange}
          />
        </section>

        <section className="space-y-2">
          {files.map((entry) => {
            const isPdf = entry.file.type === "application/pdf";
            const iconClass = isPdf ? "text-red-600" : "text-slate-600";

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  {isPdf ? (
                    <FileUp className={`h-5 w-5 ${iconClass}`} />
                  ) : (
                    <FileText className={`h-5 w-5 ${iconClass}`} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{entry.file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(entry.file.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {entry.status === "uploading" && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" /> <span>Uploading...</span>
                    </div>
                  )}

                  {entry.status === "success" && (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{entry.chunks ?? "?"} chunks indexed</span>
                    </div>
                  )}

                  {entry.status === "error" && (
                    <div className="flex items-center gap-1 text-rose-600">
                      <XCircle className="h-4 w-4" />
                      <span>{entry.errorMessage ?? "Upload failed"}</span>
                    </div>
                  )}

                  {(entry.status === "success" || entry.status === "error") && (
                    <button
                      type="button"
                      onClick={() => removeFile(entry.id)}
                      className="rounded-md p-1 hover:bg-slate-100"
                    >
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {hasSuccessful && (
          <section className="mt-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Go to Chat
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
