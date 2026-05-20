"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Sparkles, History, Plus, MessageSquare, ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useArkoChat, type ArkoChatContext } from "@/hooks/useArkoChat";
import { ArkoMessage, ThinkingIndicator } from "@/components/chat/ChatShared";
import type { ContentItem } from "@/types/content-plan";

interface MokaContentPanelProps {
  open: boolean;
  workspaceId: string;
  context?: ArkoChatContext;
  /** Items del pipeline para generar sugerencias dinámicas. Solo se usa si no se pasan `suggestions` explícitas. */
  items?: ContentItem[];
  /** Sugerencias custom. Si se omiten y se pasa `items`, se calculan dinámicamente; si no, usa DEFAULT_SUGGESTIONS. */
  suggestions?: string[];
  greeting?: string;
  onClose: () => void;
  onContentAdded?: (items: Record<string, unknown>[]) => void;
  onContentUpdated?: (item: Record<string, unknown>) => void;
  onContentDeleted?: (id: string) => void;
}

interface SessionMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

type SuggestionT = (
  key:
    | "default1" | "default2" | "default3" | "default4"
    | "scriptForIdea" | "scriptsForReadyToRecord"
    | "prioritizeIdeas" | "generateNewIdeas"
    | "captionsForEditing" | "weekPlan",
  values?: Record<string, string | number>
) => string;

function defaultSuggestions(t: SuggestionT): string[] {
  return [t("default1"), t("default2"), t("default3"), t("default4")];
}

/**
 * Build context-aware suggestions based on what's in the user's pipeline.
 * Falls back to default suggestions when the pipeline is empty.
 */
function buildSuggestions(items: ContentItem[] | undefined, t: SuggestionT): string[] {
  if (!items || items.length === 0) return defaultSuggestions(t);

  const ideas       = items.filter((i) => i.status === "idea");
  const noScript    = items.filter((i) => i.status === "ready_to_record" && !i.script);
  const ideaNoScript = ideas.find((i) => !i.script);
  const editing     = items.filter((i) => i.status === "editing");

  const out: string[] = [];

  if (ideaNoScript) {
    out.push(t("scriptForIdea", { title: ideaNoScript.title }));
  }
  if (noScript.length > 0) {
    out.push(t("scriptsForReadyToRecord", { n: noScript.length }));
  }
  if (ideas.length >= 3) {
    out.push(t("prioritizeIdeas", { n: ideas.length }));
  } else {
    out.push(t("generateNewIdeas"));
  }
  if (editing.length > 0) {
    out.push(t("captionsForEditing", { n: editing.length }));
  }
  out.push(t("weekPlan"));

  return out.slice(0, 4);
}

function useFormatRelativeDate() {
  const t = useTranslations("mesaDeTrabajo.mokaPanel");
  const locale = useLocale();
  return (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (mins  < 1)  return t("now");
    if (mins  < 60) return t("minutesAgo", { n: mins });
    if (hours < 24) return t("hoursAgo",   { n: hours });
    if (days  < 7)  return t("daysAgo",    { n: days });
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-AR", { day: "numeric", month: "short" });
  };
}

export function MokaContentPanel({
  open,
  workspaceId,
  context,
  items,
  suggestions,
  greeting,
  onClose,
  onContentAdded,
  onContentUpdated,
  onContentDeleted,
}: MokaContentPanelProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const tp = useTranslations("mesaDeTrabajo.mokaPanel");
  const formatRelativeDate = useFormatRelativeDate();

  const [input, setInput]             = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions]       = useState<SessionMeta[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Default context: si el caller no pasa context y hay items, asumimos Mesa de Trabajo.
  const effectiveContext: ArkoChatContext | undefined =
    context ?? (items !== undefined ? { type: "mesa-de-trabajo" } : undefined);

  const {
    messages,
    isLoading,
    statusLabel,
    toolSteps,
    sessionId,
    setSessionId,
    setMessages,
    sendMessage,
    loadSessionMessages,
  } = useArkoChat({
    workspaceId,
    context: effectiveContext,
    onContentAdded,
    onContentUpdated,
    onContentDeleted,
  });

  const tSugg = useTranslations("mesaDeTrabajo.mokaPanel.suggestions");
  // Sugerencias: prop explícita > dinámicas según items > defaults.
  const dynamicSuggestions = useMemo(() => buildSuggestions(items, tSugg as unknown as SuggestionT), [items, tSugg]);
  const activeSuggestions = suggestions ?? (items !== undefined ? dynamicSuggestions : defaultSuggestions(tSugg as unknown as SuggestionT));
  const activeGreeting = greeting ?? tp("greeting");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, toolSteps.length, statusLabel, scrollToBottom]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  async function fetchSessions() {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/v1/chat/sessions", {
        headers: { "x-workspace-id": workspaceId },
      });
      if (res.ok) {
        const data = await res.json() as { data: SessionMeta[] };
        setSessions(data.data ?? []);
      }
    } finally {
      setLoadingSessions(false);
    }
  }

  function openHistory() {
    fetchSessions();
    setShowHistory(true);
  }

  function handleSelectSession(sid: string) {
    setSessionId(sid);
    loadSessionMessages(sid);
    setShowHistory(false);
  }

  function handleNewConversation() {
    setSessionId(null);
    setMessages([]);
    setShowHistory(false);
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const border      = isLight ? "rgba(17,17,17,0.08)"  : "rgba(255,255,255,0.07)";
  const textMain    = isLight ? "#111111"               : "rgba(255,255,255,0.85)";
  const textSub     = isLight ? "rgba(17,17,17,0.45)"  : "rgba(255,255,255,0.38)";
  const bg          = isLight ? "#f8f8fa"               : "rgba(0,0,0,0.3)";
  const inputBg     = isLight ? "rgba(17,17,17,0.04)"  : "rgba(255,255,255,0.04)";
  const inputBorder = isLight ? "rgba(17,17,17,0.10)"  : "rgba(255,255,255,0.08)";
  const hoverBg     = isLight ? "rgba(17,17,17,0.05)"  : "rgba(255,255,255,0.05)";

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: textSub,
    transition: "background 0.15s, color 0.15s",
    cursor: "pointer",
    background: "transparent",
    border: "none",
  };

  return (
    <>
      {/* Backdrop — click closes */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-[80] flex flex-col w-[720px] max-w-[90vw] h-dvh shadow-[-8px_0_40px_rgba(0,0,0,0.15)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ borderLeft: `1px solid ${border}`, background: bg }}
      >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2.5">
          {showHistory ? (
            <button
              style={iconBtnStyle}
              onClick={() => setShowHistory(false)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = textMain; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
              title={tp("backToChat")}
            >
              <ArrowLeft size={14} />
            </button>
          ) : (
            <Image
              src="/logos/moka.svg"
              alt="Moka"
              width={22}
              height={22}
              style={{ opacity: 0.7, objectFit: "contain" }}
            />
          )}
          <div>
            <p className="text-[13px] font-medium leading-none" style={{ color: textMain }}>
              {showHistory ? tp("conversations") : tp("name")}
            </p>
            <p className="text-[11px] leading-none mt-0.5" style={{ color: textSub }}>
              {showHistory ? tp("chatHistory") : tp("subtitle")}
            </p>
          </div>
        </div>

        {/* Header actions */}
        {!showHistory && (
          <div className="flex items-center gap-1">
            <button
              style={iconBtnStyle}
              onClick={handleNewConversation}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = textMain; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
              title={tp("newConversation")}
            >
              <Plus size={14} />
            </button>
            <button
              style={{
                ...iconBtnStyle,
                background: showHistory ? hoverBg : "transparent",
              }}
              onClick={openHistory}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = textMain; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
              title={tp("history")}
            >
              <History size={14} />
            </button>
            {onClose && (
              <button
                style={iconBtnStyle}
                onClick={onClose}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; (e.currentTarget as HTMLElement).style.color = textMain; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
                title={tp("close")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── History panel ── */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* New conversation button */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                color: textMain,
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = hoverBg}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = inputBg}
            >
              <Plus size={14} style={{ color: textSub }} />
              {tp("newConversation")}
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 px-3 pb-3 flex flex-col gap-1">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-[12px]" style={{ color: textSub }}>{tp("loading")}</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <MessageSquare size={22} style={{ color: textSub, opacity: 0.5 }} />
                <p className="text-[12px]" style={{ color: textSub }}>{tp("emptyConversations")}</p>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === sessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? hoverBg : "transparent",
                      border: `1px solid ${isActive ? inputBorder : "transparent"}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <p
                      className="text-[12px] font-medium leading-tight truncate"
                      style={{ color: isActive ? textMain : isLight ? "rgba(17,17,17,0.7)" : "rgba(255,255,255,0.65)" }}
                    >
                      {s.title || tp("untitledConversation")}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: textSub }}>
                      {formatRelativeDate(s.updated_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex gap-2.5 items-start">
                  <Image
                    src="/logos/moka.svg"
                    alt="Moka"
                    width={28}
                    height={28}
                    className="shrink-0 mt-0.5"
                    style={{ opacity: 0.6, objectFit: "contain" }}
                  />
                  <div
                    className="rounded-xl rounded-tl-sm px-3 py-2.5 text-[13px] leading-relaxed max-w-[85%]"
                    style={{
                      background: isLight ? "rgba(17,17,17,0.05)" : "rgba(255,255,255,0.06)",
                      color: isLight ? "#111111" : "rgba(255,255,255,0.8)",
                      border: `1px solid ${border}`,
                    }}
                  >
                    {activeGreeting}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pl-9">
                  {activeSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                      className="text-left text-[12px] px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                        color: isLight ? "rgba(17,17,17,0.6)" : "rgba(255,255,255,0.5)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = hoverBg}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = inputBg}
                    >
                      <Sparkles size={11} className="inline mr-1.5 opacity-50" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ArkoMessage key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {(isLoading || statusLabel || toolSteps.length > 0) && (
                  <ThinkingIndicator statusLabel={statusLabel} toolSteps={toolSteps} />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ── */}
          <div
            className="shrink-0 px-3 pb-3 pt-2"
            style={{ borderTop: `1px solid ${border}` }}
          >
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: inputBg, border: `1px solid ${inputBorder}` }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tp("placeholder")}
                rows={1}
                className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder-opacity-40"
                style={{ color: textMain }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{
                  background: isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)",
                  color: textMain,
                }}
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: textSub }}>
              {tp("hint")}
            </p>
          </div>
        </>
      )}
      </div>
    </>
  );
}
