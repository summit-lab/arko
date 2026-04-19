"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AdnMessage } from "./AdnMessage";
import { AdnDocsPanel } from "./AdnDocsPanel";
import { AdnCompetitorModal, type CompetitorEntry } from "./AdnCompetitorModal";
import type { AdnProgress, AdnData } from "@/services/adn-progress.service";

/** Parse the combined why_better DB field back into likes_brand + likes_content */
function parseWhyBetter(raw: string | null): { likes_brand: string; likes_content: string } {
  if (!raw) return { likes_brand: "", likes_content: "" };
  const brandMatch = raw.match(/\[MARCA]\s*([\s\S]*?)(?=\n?\[CONTENIDO]|$)/);
  const contentMatch = raw.match(/\[CONTENIDO]\s*([\s\S]*?)$/);
  if (brandMatch || contentMatch) {
    return {
      likes_brand: brandMatch?.[1]?.trim() ?? "",
      likes_content: contentMatch?.[1]?.trim() ?? "",
    };
  }
  // Legacy data without markers — put it all in likes_brand
  return { likes_brand: raw, likes_content: "" };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface AdnChatProps {
  initialMessages: ChatMessage[];
  initialProgress: AdnProgress;
  initialData: AdnData;
  welcomeMessage: string;
  sessionId: string;
  workspaceId: string;
}

export function AdnChat({
  initialMessages,
  initialProgress,
  initialData,
  welcomeMessage,
  sessionId,
  workspaceId,
}: AdnChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [progress, setProgress] = useState<AdnProgress>(initialProgress);
  const [adnData, setAdnData] = useState<AdnData>(initialData);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(initialProgress.overall_complete);
  const [competitorModalOpen, setCompetitorModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayMessages: ChatMessage[] =
    messages.length > 0
      ? messages
      : [
          {
            id: "welcome",
            role: "assistant" as const,
            content: welcomeMessage,
            created_at: new Date().toISOString(),
          },
        ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Refresh ADN data after each assistant response
  const refreshAdnData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/onboarding/adn", {
        headers: { "x-workspace-id": workspaceId },
      });
      if (res.ok) {
        const result = await res.json();
        setProgress(result.data.progress);
        setAdnData(result.data.data);
      }
    } catch {
      // silent
    }
  }, [workspaceId]);

  const handleDataUpdate = useCallback((newProgress: AdnProgress, newData: AdnData) => {
    setProgress(newProgress);
    setAdnData(newData);
  }, []);

  const openCompetitorModal = useCallback(() => {
    setCompetitorModalOpen(true);
  }, []);

  const saveCompetitors = useCallback(async (competitors: CompetitorEntry[]) => {
    const res = await fetch("/api/v1/onboarding/adn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceId,
      },
      body: JSON.stringify({ competitors }),
    });
    if (res.ok) {
      const result = await res.json();
      setProgress(result.data.progress);
      setAdnData(result.data.data);
    }
  }, [workspaceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/v1/onboarding/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) throw new Error("Error al enviar mensaje");

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: data.data.message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.data.progress) {
        setProgress(data.data.progress);
      }

      // Refresh full ADN data to show in panel
      await refreshAdnData();

      if (data.data.is_complete && !isComplete) {
        setIsComplete(true);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Hubo un error al procesar tu mensaje. ¿Podés intentar de nuevo?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  void sessionId;

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden">
      {/* ── Chat ── */}
      <div className="flex-[3] flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 px-8">
          <div className="max-w-[85%] mx-auto space-y-4">
            {displayMessages.map((msg) => (
              <AdnMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                onCompetitorFormClick={openCompetitorModal}
                competitorCount={adnData.competitors.length}
              />
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="glass-card px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[11px] text-white/25 font-light">Moka está pensando...</span>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="flex justify-center py-6">
                <div className="glass-card px-8 py-5 text-center border-emerald-500/20">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-2.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-[16px] font-light text-white/90 mb-1">ADN de Comunicación completo</p>
                  <p className="text-[12px] text-white/40 font-light">Podés pedirle a Moka que modifique cualquier dato.</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 px-8 pb-6 pt-3">
          <div className="max-w-[85%] mx-auto">
            <form
              onSubmit={handleSubmit}
              className="relative rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 focus-within:border-white/[0.16] focus-within:bg-white/[0.06]"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isComplete ? "Pedile a Moka que modifique algo..." : "Escribí tu respuesta..."}
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent text-[14px] text-white/85 placeholder:text-white/20 font-light resize-none focus:outline-none leading-relaxed px-5 pt-3.5 pb-3 pr-14 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2.5 bottom-2.5 h-9 w-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-20 disabled:hover:bg-white/[0.08] transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
            <p className="text-[10px] text-white/15 mt-2 text-center font-light">
              Shift + Enter para nueva línea
            </p>
          </div>
        </div>
      </div>

      {/* ── Docs Panel ── */}
      <aside className="flex-[2] shrink-0 min-w-[320px] max-w-[480px] p-5 overflow-hidden border-l border-white/[0.06] bg-white/[0.01] flex flex-col">
        <AdnDocsPanel
          progress={progress}
          data={adnData}
          workspaceId={workspaceId}
          onDataUpdate={handleDataUpdate}
          onEditCompetitors={openCompetitorModal}
        />
      </aside>

      {/* ── Competitor Modal ── */}
      <AdnCompetitorModal
        open={competitorModalOpen}
        onClose={() => setCompetitorModalOpen(false)}
        onSave={saveCompetitors}
        initialCompetitors={
          adnData.competitors.length > 0
            ? adnData.competitors.map((c) => ({
                id: c.id ?? undefined,
                name: c.name ?? "",
                ig_url: c.ig_url ?? "",
                ...parseWhyBetter(c.why_better),
              }))
            : undefined
        }
      />
    </div>
  );
}
