import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Chatbot",
  description: "Chat with your documents using Endee and Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
