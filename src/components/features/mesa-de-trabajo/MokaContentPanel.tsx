"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles } from "lucide-react";
import Image from "next/image";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useArkoChat } from "@/hooks/useArkoChat";
import { ArkoMessage, ThinkingIndicator } from "@/components/chat/ChatShared";

interface MokaContentPanelProps {
  workspaceId: string;
}

const SUGGESTIONS = [
  "Generame 3 ideas de reels para esta semana",
  "¿Qué tipo de contenido me funciona mejor?",
  "Escribime un script para un reel de ventas",
  "¿Cuál es la mejor hora para publicar?",
];

export function MokaContentPanel({ workspaceId }: MokaContentPanelProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isLoading, statusLabel, toolSteps, sendMessage } =
    useArkoChat({ workspaceId });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, toolSteps.length, statusLabel, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

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

  const border   = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const textSub  = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const bg       = isLight ? "#f8f8fa" : "rgba(0,0,0,0.3)";
  const inputBg  = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const inputBorder = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.08)";

  return (
    <div
      className="flex flex-col h-full"
      style={{
        borderLeft: `1px solid ${border}`,
        background: bg,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <Image
          src="/logos/moka.svg"
          alt="Moka"
          width={22}
          height={22}
          style={{ opacity: 0.7, objectFit: "contain" }}
        />
        <div>
          <p
            className="text-[13px] font-medium leading-none"
            style={{ color: isLight ? "#111111" : "rgba(255,255,255,0.85)" }}
          >
            Moka AI
          </p>
          <p className="text-[11px] leading-none mt-0.5" style={{ color: textSub }}>
            Asistente de contenido
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4 pt-2">
            {/* Greeting */}
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
                Hola 👋 Estoy acá para ayudarte con tu contenido. ¿Qué creamos hoy?
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-col gap-1.5 pl-9">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-left text-[12px] px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${inputBorder}`,
                    color: isLight ? "rgba(17,17,17,0.6)" : "rgba(255,255,255,0.5)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isLight
                      ? "rgba(17,17,17,0.08)"
                      : "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isLight
                      ? "rgba(17,17,17,0.04)"
                      : "rgba(255,255,255,0.04)";
                  }}
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
              <ThinkingIndicator
                statusLabel={statusLabel}
                toolSteps={toolSteps}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: `1px solid ${border}` }}
      >
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            background: inputBg,
            border: `1px solid ${inputBorder}`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntale a Moka…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder-opacity-40"
            style={{
              color: isLight ? "#111111" : "rgba(255,255,255,0.85)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)",
              color: isLight ? "#111111" : "white",
            }}
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-center mt-1.5" style={{ color: textSub }}>
          Enter para enviar · Shift+Enter nueva línea
        </p>
      </div>
    </div>
  );
}
