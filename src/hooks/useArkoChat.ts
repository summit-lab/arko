"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ChatMessage, ToolStep } from "@/components/chat/ChatShared";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReelChatContext {
  type: "reel";
  reel_id: string;
  reel_data: string;
  gemini_analysis: string | null;
}

export interface ScriptChatContext {
  type: "script";
  script_id: string;
  title: string | null;
  content_type: string | null;
  status: string | null;
  planned_date: string | null;
  script: string | null;
}

export interface MesaDeTrabajoChatContext {
  type: "mesa-de-trabajo";
}

export type ArkoChatContext = ReelChatContext | ScriptChatContext | MesaDeTrabajoChatContext;

interface UseArkoChatOptions {
  workspaceId: string;
  context?: ArkoChatContext;
  onContentAdded?: (items: Record<string, unknown>[]) => void;
  onContentUpdated?: (item: Record<string, unknown>) => void;
  onContentDeleted?: (id: string) => void;
}

interface UseArkoChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  statusLabel: string | null;
  toolSteps: ToolStep[];
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendMessage: (text: string) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useArkoChat({
  workspaceId,
  context,
  onContentAdded,
  onContentUpdated,
  onContentDeleted,
}: UseArkoChatOptions): UseArkoChatReturn {
  const t = useTranslations("arkoChat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync
  const updateSessionId = useCallback((id: string | null) => {
    setSessionId(id);
    sessionIdRef.current = id;
  }, []);

  // Load messages for an existing session
  const loadSessionMessages = useCallback(
    async (sid: string) => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/v1/chat/messages?session_id=${sid}`,
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

  // Send a message via SSE
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStatusLabel(t("thinking"));
      setToolSteps([]);

      let streamCompleted = false;

      try {
        const body: Record<string, unknown> = {
          session_id: sessionIdRef.current,
          message: trimmed,
        };

        // Always send context for reel sessions so the system prompt
        // includes reel data on every message (not just the first one)
        if (context) {
          body.context = context;
        }

        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": workspaceId,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) throw new Error(t("errors.send"));

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
                  if (!sessionIdRef.current) {
                    updateSessionId(sid);
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
                      event.message?.content ?? t("errors.generate"),
                    created_at:
                      event.message?.created_at ?? new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, assistantMsg]);
                  setIsLoading(false);
                  setStatusLabel(null);
                  setToolSteps([]);
                  break;
                }

                case "content_added":
                  if (onContentAdded && Array.isArray(event.items)) onContentAdded(event.items as Record<string, unknown>[]);
                  break;

                case "content_updated":
                  if (onContentUpdated && event.item) onContentUpdated(event.item as Record<string, unknown>);
                  break;

                case "content_deleted": {
                  const deletedId = (typeof event.id === "string" ? event.id : event.item?.id) as string | undefined;
                  if (onContentDeleted && deletedId) onContentDeleted(deletedId);
                  break;
                }

                case "error":
                  throw new Error(event.message || t("errors.server"));
              }
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                parseErr.message !== "Unexpected end of JSON input"
              ) {
                throw parseErr;
              }
            }
          }
        }

        if (!streamCompleted) {
          // Stream ended without a "done" event — likely a timeout or server crash
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: t("errors.timeout"),
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsLoading(false);
          setStatusLabel(null);
          setToolSteps([]);
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: t("errors.processing"),
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        setStatusLabel(null);
        setToolSteps([]);
      }
    },
    [isLoading, workspaceId, context, updateSessionId, t, onContentAdded, onContentUpdated, onContentDeleted],
  );

  return {
    messages,
    isLoading,
    isLoadingMessages,
    statusLabel,
    toolSteps,
    sessionId,
    setSessionId: updateSessionId,
    setMessages,
    sendMessage,
    loadSessionMessages,
  };
}
