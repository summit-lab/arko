"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, MessageSquareText } from "lucide-react";
import {
  ArkoMessage,
  ThinkingIndicator,
  MessagesSkeleton,
  ArkoLogoSmall,
} from "@/components/chat/ChatShared";
import { useArkoChat } from "@/hooks/useArkoChat";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReelChatPanelProps {
  reelId: string;
  workspaceId: string;
  reelSummary: string;
  geminiAnalysis: string | null;
  reelCaption: string;
  performerMultiple: number;
  hasGeminiAnalysis: boolean;
}

// ─── Suggested questions (dynamic) ──────────────────────────────────────────

function buildSuggestions(
  performerMultiple: number,
  hasGemini: boolean,
): string[] {
  const suggestions: string[] = [];

  if (performerMultiple >= 1.5) {
    suggestions.push("¿Por qué este reel funcionó tan bien?");
  } else if (performerMultiple < 0.8 && performerMultiple > 0) {
    suggestions.push("¿Por qué este reel no funcionó?");
  } else {
    suggestions.push("¿Cómo puedo mejorar este reel?");
  }

  suggestions.push("Analizá el hook de este reel");
  suggestions.push("Dame ideas para iterar este concepto");
  suggestions.push("Evaluá el CTA de este reel");

  if (!hasGemini) {
    suggestions.push("¿Qué análisis adicional me recomendás?");
  } else {
    suggestions.push("¿Qué puedo mejorar en la estructura?");
  }

  return suggestions.slice(0, 5);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReelChatPanel({
  reelId,
  workspaceId,
  reelSummary,
  geminiAnalysis,
  reelCaption,
  performerMultiple,
  hasGeminiAnalysis,
}: ReelChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [hasDiscoveredSession, setHasDiscoveredSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    isLoadingMessages,
    statusLabel,
    toolSteps,
    sessionId,
    setSessionId,
    sendMessage,
    loadSessionMessages,
  } = useArkoChat({
    workspaceId,
    context: {
      type: "reel",
      reel_id: reelId,
      reel_data: reelSummary,
      gemini_analysis: geminiAnalysis,
    },
  });

  const suggestions = buildSuggestions(performerMultiple, hasGeminiAnalysis);

  // Auto-scroll on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, toolSteps.length, statusLabel, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Discover existing session for this reel when panel opens
  useEffect(() => {
    if (!isOpen || hasDiscoveredSession) return;

    async function discoverSession() {
      try {
        const res = await fetch(
          `/api/v1/chat/sessions?reel_id=${reelId}`,
          { headers: { "x-workspace-id": workspaceId } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const sessions = data.data ?? [];
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
          await loadSessionMessages(sessions[0].id);
        }
      } catch {
        // Ignore — will create new session on first message
      } finally {
        setHasDiscoveredSession(true);
      }
    }

    discoverSession();
  }, [isOpen, hasDiscoveredSession, reelId, workspaceId, setSessionId, loadSessionMessages]);

  // Send message handler
  async function handleSubmit(e?: React.FormEvent, overrideMessage?: string) {
    if (e) e.preventDefault();
    const trimmed = (overrideMessage ?? input).trim();
    if (!trimmed || isLoading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await sendMessage(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const captionPreview = reelCaption.length > 60
    ? `${reelCaption.slice(0, 57)}...`
    : reelCaption;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-border bg-popover/90 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.22)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 hover:bg-accent cursor-pointer group"
        >
          <div className="h-7 w-7 rounded-lg bg-accent border border-border flex items-center justify-center">
            <ArkoLogoSmall size={14} opacity={0.6} />
          </div>
          <span className="text-[13px] font-light text-popover-foreground/80 group-hover:text-popover-foreground transition-colors">
            Preguntale a Moka
          </span>
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex flex-col w-[720px] max-w-[90vw] h-dvh border-l border-border bg-popover backdrop-blur-2xl shadow-[-8px_0_40px_rgba(0,0,0,0.15)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="h-7 w-7 rounded-lg bg-accent border border-border flex items-center justify-center shrink-0">
            <ArkoLogoSmall size={12} opacity={0.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-popover-foreground truncate">
              Moka AI — Reel
            </p>
            <p className="text-[10px] text-muted-foreground font-light truncate">
              {captionPreview}
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="shrink-0 h-7 w-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {messages.length === 0 && !isLoadingMessages ? (
              <ReelChatEmpty
                suggestions={suggestions}
                onSuggestionClick={(text) => handleSubmit(undefined, text)}
              />
            ) : isLoadingMessages ? (
              <MessagesSkeleton />
            ) : (
              messages.map((msg) => (
                <ArkoMessage key={msg.id} role={msg.role} content={msg.content} />
              ))
            )}

            {isLoading && (
              <ThinkingIndicator
                statusLabel={statusLabel}
                toolSteps={toolSteps}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border p-3">
          <form
            onSubmit={handleSubmit}
            className="relative rounded-xl border border-border bg-muted backdrop-blur-xl transition-all duration-300 focus-within:border-ring focus-within:bg-accent"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntale sobre este reel..."
              disabled={isLoading}
              rows={1}
              className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground font-light resize-none focus:outline-none leading-relaxed px-4 pt-3 pb-2.5 pr-12 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-accent hover:bg-accent/70 disabled:opacity-20 disabled:hover:bg-accent transition-all duration-200 flex items-center justify-center cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent-foreground"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Backdrop overlay when panel is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

// ─── Empty state for reel chat ──────────────────────────────────────────────

function ReelChatEmpty({
  suggestions,
  onSuggestionClick,
}: {
  suggestions: string[];
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 blur-xl opacity-15 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(120,120,120,0.3) 0%, transparent 70%)" }}
        />
        <div className="relative h-14 w-14 rounded-xl bg-accent border border-border flex items-center justify-center backdrop-blur-sm">
          <ArkoLogoSmall size={24} opacity={0.5} />
        </div>
      </div>

      <p className="text-[13px] font-light text-foreground mb-1">
        Moka AI
      </p>
      <p className="text-[11px] text-muted-foreground font-light text-center mb-6 max-w-[280px]">
        Preguntame lo que quieras sobre este reel. Tengo todas las métricas y el contexto de tu cuenta.
      </p>

      <div className="w-full space-y-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-all text-[11.5px] text-muted-foreground hover:text-foreground font-light leading-relaxed cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
