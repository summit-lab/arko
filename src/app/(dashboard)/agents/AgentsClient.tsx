"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { AdnBlockOverlay } from "@/components/features/onboarding/AdnAlertBanner";
import {
  ArkoMessage,
  ThinkingIndicator,
  MessagesSkeleton,
  ArkoLogoSmall,
} from "@/components/chat/ChatShared";
import { useArkoChat } from "@/hooks/useArkoChat";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ArkoAIClientProps {
  adnComplete: boolean;
  initialSessions: Session[];
  workspaceId: string;
}

// ─── Suggested questions ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Analizá mis últimos reels y decime qué patrón ves",
  "¿Cómo viene mi rendimiento este mes?",
  "Dame ideas de hooks basadas en lo que mejor me funciona",
  "¿Cuál es mi diferenciador principal vs la competencia?",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ArkoAIClient({
  adnComplete,
  initialSessions,
  workspaceId,
}: ArkoAIClientProps) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    isLoadingMessages,
    statusLabel,
    toolSteps,
    sessionId: activeSessionId,
    setSessionId: setActiveSessionId,
    setMessages,
    sendMessage,
    loadSessionMessages,
  } = useArkoChat({ workspaceId });

  // Auto-scroll
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Select session
  const selectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      loadSessionMessages(sessionId);
    },
    [activeSessionId, setActiveSessionId, loadSessionMessages],
  );

  // New conversation
  const startNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  }, [setActiveSessionId, setMessages]);

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      await fetch(
        `/api/v1/chat/sessions?id=${sessionId}`,
        { method: "DELETE", headers: { "x-workspace-id": workspaceId } },
      );
    },
    [activeSessionId, workspaceId, setActiveSessionId, setMessages],
  );

  // Send message handler
  async function handleSubmit(e?: React.FormEvent, overrideMessage?: string) {
    if (e) e.preventDefault();
    const trimmed = (overrideMessage ?? input).trim();
    if (!trimmed || isLoading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Track new session creation for sidebar
    const hadSession = !!activeSessionId;
    await sendMessage(trimmed);

    // If a new session was created, add it to the sidebar
    if (!hadSession) {
      // The hook updates sessionId internally; we need to read it after
      // We use a small delay to let state propagate
      setTimeout(() => {
        setSessions((prev) => {
          // Check if session was already added
          const currentSid = activeSessionId;
          if (currentSid && !prev.some((s) => s.id === currentSid)) {
            return [
              {
                id: currentSid,
                title: trimmed.substring(0, 80),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              ...prev,
            ];
          }
          return prev;
        });
      }, 500);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] w-full overflow-hidden">
      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {!adnComplete && <AdnBlockOverlay />}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 px-12">
          <div className="max-w-5xl mx-auto space-y-4">
            {messages.length === 0 && !isLoadingMessages ? (
              <EmptyState
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
        <div className="shrink-0 px-12 pb-6 pt-3">
          <div className="max-w-5xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="relative rounded-xl border border-border bg-card backdrop-blur-xl shadow-md transition-all duration-300 focus-within:border-ring focus-within:bg-accent"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Preguntale a Moka..."
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground font-light resize-none focus:outline-none leading-relaxed px-5 pt-3.5 pb-3 pr-14 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2.5 bottom-2.5 h-9 w-9 rounded-lg bg-accent hover:bg-accent/70 disabled:opacity-20 disabled:hover:bg-accent transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
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
            <p className="text-[10px] text-muted-foreground mt-2 text-center font-light">
              Shift + Enter para nueva línea
            </p>
          </div>
        </div>
      </div>

      {/* ── Session sidebar (right) ── */}
      <aside className="w-60 shrink-0 border-l border-border bg-card/40 flex flex-col">
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent/70 border border-border text-[13px] font-light text-accent-foreground transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva conversación
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessions.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => selectSession(session.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectSession(session.id); }}
              className={`group w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-start gap-2 cursor-pointer ${
                activeSessionId === session.id
                  ? "bg-accent border border-border"
                  : "hover:bg-accent/50 border border-transparent"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground/85 font-light truncate">
                  {session.title}
                </p>
                <p className="text-[10px] text-muted-foreground font-light mt-0.5">
                  {formatDate(session.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-all shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
              </button>
            </div>
          ))}

          {sessions.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-8 font-light">
              Sin conversaciones aún
            </p>
          )}
        </div>
      </aside>

    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] py-16">
      <div className="relative mb-8 group">
        <div
          className="absolute inset-0 blur-2xl opacity-20 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(120,120,120,0.3) 0%, transparent 70%)" }}
        />
        <div className="relative h-20 w-20 rounded-2xl bg-accent border border-border flex items-center justify-center backdrop-blur-sm cursor-pointer">
          <ArkoLogoSmall size={56} opacity={1} className="moka-head-tilt-right" />
        </div>

        {/* Woof! speech bubble — pixel/retro, aparece al hover del contenedor.
            Tail largo que baja hacia el Moka, como saliendo de su boca. */}
        <div
          className="absolute -top-10 -right-10 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ease-out pointer-events-none select-none"
        >
          <div
            className="relative px-3 py-1.5 font-mono font-bold uppercase tracking-wider text-[13px] text-foreground"
            style={{
              background: "var(--background)",
              border: "3px solid var(--foreground)",
              boxShadow: "4px 4px 0 var(--foreground)",
            }}
          >
            Woof!
            {/* Tail largo — tip hacia abajo-izquierda, llega cerca del Moka.
                Dos layers (border + fill) para respetar el grosor del border. */}
            <span
              className="absolute w-0 h-0"
              style={{
                bottom: "-26px",
                left: "4px",
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: "26px solid var(--foreground)",
              }}
            />
            <span
              className="absolute w-0 h-0"
              style={{
                bottom: "-20px",
                left: "8px",
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "20px solid var(--background)",
              }}
            />
          </div>
        </div>
      </div>

      <h2 className="text-[20px] font-light text-foreground mb-2 tracking-wide">
        Moka AI
      </h2>
      <p className="text-[13px] text-muted-foreground font-light max-w-md text-center mb-10">
        Tu consultor de marketing con acceso a toda la data de tu workspace.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="text-left p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-border transition-all text-[12px] text-muted-foreground hover:text-foreground font-light leading-relaxed cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
