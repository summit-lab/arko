"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, MessageSquare, CheckCircle2 } from "lucide-react";
import { AdnBlockOverlay } from "@/components/features/onboarding/AdnAlertBanner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

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

interface ToolStep {
  tool: string;
  label: string;
  status: "running" | "done";
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Load messages when session changes
  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/v1/chat/messages?session_id=${sessionId}`,
          { headers: { "x-workspace-id": workspaceId } },
        );
        if (!res.ok) {
          setMessages([]);
          return;
        }
        const data = await res.json();
        setMessages(data.data ?? []);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [workspaceId],
  );

  // Select session
  const selectSession = useCallback(
    (sessionId: string) => {
      if (sessionId === activeSessionId) return;
      setActiveSessionId(sessionId);
      loadSessionMessages(sessionId);
    },
    [activeSessionId, loadSessionMessages],
  );

  // New conversation
  const startNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  }, []);

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
    [activeSessionId, workspaceId],
  );

  // Send message — SSE consumer
  async function handleSubmit(e?: React.FormEvent, overrideMessage?: string) {
    if (e) e.preventDefault();
    const trimmed = (overrideMessage ?? input).trim();
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
    setStatusLabel("Pensando...");
    setToolSteps([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let streamCompleted = false;

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          session_id: activeSessionId,
          message: trimmed,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Error al enviar mensaje");

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case "session": {
                const sid = event.session_id;
                if (!activeSessionId) {
                  setActiveSessionId(sid);
                  setSessions((prev) => [
                    {
                      id: sid,
                      title: trimmed.substring(0, 80),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    ...prev,
                  ]);
                }
                break;
              }

              case "status":
                setStatusLabel(event.label);
                break;

              case "tool_start":
                setToolSteps((prev) => [
                  ...prev,
                  { tool: event.tool, label: event.label, status: "running" },
                ]);
                setStatusLabel(null);
                break;

              case "tool_done":
                setToolSteps((prev) =>
                  prev.map((step) =>
                    step.tool === event.tool
                      ? { ...step, status: "done" }
                      : step,
                  ),
                );
                break;

              case "done": {
                streamCompleted = true;
                const assistantMsg: ChatMessage = {
                  id: event.message?.id ?? `resp-${Date.now()}`,
                  role: "assistant",
                  content:
                    event.message?.content ?? "Error al generar respuesta.",
                  created_at:
                    event.message?.created_at ?? new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setIsLoading(false);
                setStatusLabel(null);
                setToolSteps([]);
                break;
              }

              case "error":
                throw new Error(event.message || "Error del servidor");
            }
          } catch (parseErr) {
            // If it's a rethrown error from "error" event, propagate it
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") {
              throw parseErr;
            }
          }
        }
      }

      // If stream ended without a 'done' event, clean up
      if (!streamCompleted) {
        setIsLoading(false);
        setStatusLabel(null);
        setToolSteps([]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "Hubo un error al procesar tu mensaje. ¿Podés intentar de nuevo?",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
      setStatusLabel(null);
      setToolSteps([]);
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
              className="relative rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 focus-within:border-white/[0.16] focus-within:bg-white/[0.06]"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Preguntale a Arko..."
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent text-[14px] text-white/85 placeholder:text-white/20 font-light resize-none focus:outline-none leading-relaxed px-5 pt-3.5 pb-3 pr-14 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2.5 bottom-2.5 h-9 w-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-20 disabled:hover:bg-white/[0.08] transition-all duration-200 flex items-center justify-center cursor-pointer"
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
                  className="text-white/70"
                >
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

      {/* ── Session sidebar (right) ── */}
      <aside className="w-60 shrink-0 border-l border-white/[0.06] bg-white/[0.01] flex flex-col">
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[13px] font-light text-white/70 hover:text-white/90 transition-all cursor-pointer"
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
                  ? "bg-white/[0.08] border border-white/[0.1]"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-white/20 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white/60 font-light truncate">
                  {session.title}
                </p>
                <p className="text-[10px] text-white/20 font-light mt-0.5">
                  {formatDate(session.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3 w-3 text-white/30 hover:text-red-400" />
              </button>
            </div>
          ))}

          {sessions.length === 0 && (
            <p className="text-[11px] text-white/15 text-center py-8 font-light">
              Sin conversaciones aún
            </p>
          )}
        </div>
      </aside>

    </div>
  );
}

// ─── Thinking Indicator (Perplexity-style) ──────────────────────────────────

function ThinkingIndicator({
  statusLabel,
  toolSteps,
}: {
  statusLabel: string | null;
  toolSteps: ToolStep[];
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-5 py-4 bg-white/[0.04] border border-white/[0.06]">
        {/* Arko header */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="h-4 w-4 rounded-full bg-gradient-to-b from-white/12 to-white/4 flex items-center justify-center">
            <svg
              width="9"
              height="9"
              viewBox="0 0 607.13 523.93"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="rgba(255,255,255,0.5)"
                d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"
              />
              <path
                fill="rgba(255,255,255,0.5)"
                d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"
              />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-white/30 tracking-wide">
            Arko
          </span>
        </div>

        {/* Tool steps */}
        <div className="space-y-2">
          {toolSteps.map((step, i) => (
            <div
              key={`${step.tool}-${i}`}
              className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {step.status === "running" ? (
                <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full border border-violet-400/60 border-t-transparent animate-spin" />
                </div>
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60 shrink-0" />
              )}
              <span
                className={`text-[12px] font-light transition-colors duration-300 ${
                  step.status === "running"
                    ? "text-white/50"
                    : "text-white/30"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}

          {/* Status label (shown when no tools are active, or as general status) */}
          {statusLabel && (
            <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
              <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full border border-violet-400/60 border-t-transparent animate-spin" />
              </div>
              <span className="text-[12px] font-light text-white/50">
                {statusLabel}
              </span>
            </div>
          )}

          {/* Fallback pulsing dots when no status and no tools */}
          {!statusLabel && toolSteps.length === 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ArkoMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed bg-white/[0.07] border border-white/[0.06] text-white/75">
          <div className="whitespace-pre-wrap font-light">
            {renderMarkdown(content)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-6 py-3.5 text-[13.5px] leading-relaxed bg-white/[0.04] border border-white/[0.06] text-white/65">
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="h-4 w-4 rounded-full bg-gradient-to-b from-white/12 to-white/4 flex items-center justify-center">
            <svg
              width="9"
              height="9"
              viewBox="0 0 607.13 523.93"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="rgba(255,255,255,0.5)"
                d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"
              />
              <path
                fill="rgba(255,255,255,0.5)"
                d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"
              />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-white/30 tracking-wide">
            Arko
          </span>
        </div>
        <div className="whitespace-pre-wrap font-light">
          {renderMarkdown(content)}
        </div>
      </div>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 my-2">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={i} className="text-[13px] font-semibold text-white/80 mt-3 mb-1">
          {renderInline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={i} className="text-[14px] font-semibold text-white/85 mt-3 mb-1">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (/^[-*] /.test(line)) {
      listItems.push(
        <li key={i} className="text-white/65">
          {renderInline(line.replace(/^[-*] /, ""))}
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      listItems.push(
        <li key={i} className="text-white/65">
          {renderInline(line.replace(/^\d+\. /, ""))}
        </li>,
      );
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<br key={i} />);
      } else {
        elements.push(
          <span key={i}>
            {renderInline(line)}
            {i < lines.length - 1 ? "\n" : ""}
          </span>,
        );
      }
    }
  }
  flushList();

  return elements;
}

function renderInline(text: string): React.ReactNode {
  return text
    .split(/(\*\*.*?\*\*|`.*?`)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white/85">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[12px] text-white/70 font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
}

function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] py-16">
      {/* Arko "A" logo with glow */}
      <div className="relative mb-8">
        <div
          className="absolute inset-0 blur-2xl opacity-20 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)" }}
        />
        <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center backdrop-blur-sm">
          <svg
            width="36"
            height="36"
            viewBox="0 0 607.13 523.93"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="empty-logo-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#empty-logo-grad)"
              d="M412.55,17.53c-4.06-10.56-14.2-17.53-25.51-17.53h-185.69l-.23.57,79.73,207.46s0,.05.02.09c.66,3.31,4.16,22.81-8.98,40.42-12.23,16.41-30.03,19.33-33.45,19.83h-121.46c-11.31,0-21.46,6.97-25.51,17.53L0,523.93h204.93l77.56-201.82c3.56-7.38,11.97-22.46,28.68-35.1,1.71-1.33,3.54-2.61,5.44-3.84,16-10.42,31.4-13.64,40.08-14.78h152.26L412.55,17.53Z"
            />
            <path
              fill="url(#empty-logo-grad)"
              d="M607.13,523.93h-204.93l-23.47-61.08c-18.53-49.04,6.47-104.64,55.35-123.28,48.72-18.58,104.22,5.99,123.21,54.68l49.84,129.68Z"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-[20px] font-light text-white/75 mb-2 tracking-wide">
        Arko AI
      </h2>
      <p className="text-[13px] text-white/30 font-light max-w-md text-center mb-10">
        Tu consultor de marketing con acceso a toda la data de tu workspace.
      </p>

      <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all text-[12px] text-white/40 hover:text-white/60 font-light leading-relaxed cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`rounded-xl px-6 py-4 ${
              i % 2 === 0
                ? "glass-card w-[60%]"
                : "bg-white/[0.07] border border-white/[0.06] w-[40%]"
            }`}
          >
            <div className="h-3 w-3/4 rounded bg-white/[0.06] mb-2" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
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
