"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Check, CheckCheck, Send, Loader2, Trash2 } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface Comment {
  id: string;
  author_name: string;
  text: string;
  resolved: boolean;
  created_at: string;
}

interface ScriptCommentsPanelProps {
  open: boolean;
  onClose: () => void;
  scriptId: string;
  workspaceId: string;
  onCountChange?: (count: number) => void;
  focusInputTrigger?: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function Initials({ name }: { name: string }) {
  const parts = name.split(/[@.\s_-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0"
      style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", color: "rgb(167,139,250)" }}>
      {initials || "?"}
    </div>
  );
}

function CommentCard({ comment, textMain, textSub, hoverBg, border, onResolve, onDelete, dimmed }: {
  comment: Comment;
  textMain: string;
  textSub: string;
  hoverBg: string;
  border: string;
  onResolve: () => void;
  onDelete: () => void;
  dimmed?: boolean;
}) {
  const displayName = comment.author_name.includes("@")
    ? comment.author_name.split("@")[0]
    : comment.author_name;

  return (
    <div
      className="group/comment rounded-xl p-3 space-y-2 transition-opacity"
      style={{ background: hoverBg, border: `1px solid ${border}`, opacity: dimmed ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-2">
        <Initials name={comment.author_name} />
        <span className="text-[11.5px] font-medium truncate flex-1" style={{ color: textMain }}>
          {displayName}
        </span>
        <span className="text-[10px] shrink-0 tabular-nums" style={{ color: textSub }}>
          {timeAgo(comment.created_at)}
        </span>
      </div>

      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: textMain }}>
        {comment.text}
      </p>

      <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
        <button
          onClick={onResolve}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer"
          style={{ color: comment.resolved ? "rgb(34,197,94)" : textSub }}
        >
          {comment.resolved ? <CheckCheck size={10} /> : <Check size={10} />}
          {comment.resolved ? "Reabrir" : "Resolver"}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ml-auto"
          style={{ color: textSub }}
        >
          <Trash2 size={10} />
          Eliminar
        </button>
      </div>
    </div>
  );
}

export function ScriptCommentsPanel({ open, onClose, scriptId, workspaceId, onCountChange, focusInputTrigger }: ScriptCommentsPanelProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [comments, setComments]   = useState<Comment[]>([]);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [text, setText]           = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const border   = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const bg       = isLight ? "#ffffff"             : "rgba(18,18,22,0.98)";
  const textMain = isLight ? "#111111"             : "rgba(255,255,255,0.9)";
  const textSub  = isLight ? "rgba(17,17,17,0.50)" : "rgba(255,255,255,0.4)";
  const hoverBg  = isLight ? "rgba(17,17,17,0.03)" : "rgba(255,255,255,0.03)";

  const headers = { "Content-Type": "application/json", "x-workspace-id": workspaceId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/scripts/${scriptId}/comments`, { headers });
      if (!res.ok) return;
      const json = await res.json() as { data: { comments: Comment[] } };
      const loaded = json.data.comments;
      setComments(loaded);
      onCountChange?.(loaded.filter((c) => !c.resolved).length);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, workspaceId]);

  useEffect(() => {
    if (open) void load();
  }, [open, scriptId, load]);

  useEffect(() => {
    if (!focusInputTrigger) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 280);
    return () => window.clearTimeout(id);
  }, [focusInputTrigger]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch(`/api/v1/scripts/${scriptId}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) { setSubmitError(true); return; }
      const json = await res.json() as { data: { comment: Comment } };
      setComments((prev) => {
        const next = [...prev, json.data.comment];
        onCountChange?.(next.filter((c) => !c.resolved).length);
        return next;
      });
      setText("");
      textareaRef.current?.focus();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id: string, currentResolved: boolean) => {
    const nextResolved = !currentResolved;
    setComments((prev) => {
      const next = prev.map((c) => c.id === id ? { ...c, resolved: nextResolved } : c);
      onCountChange?.(next.filter((c) => !c.resolved).length);
      return next;
    });
    const res = await fetch(`/api/v1/scripts/${scriptId}/comments`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ commentId: id, resolved: nextResolved }),
    });
    if (!res.ok) {
      setComments((prev) => {
        const rolled = prev.map((c) => c.id === id ? { ...c, resolved: currentResolved } : c);
        onCountChange?.(rolled.filter((c) => !c.resolved).length);
        return rolled;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      onCountChange?.(next.filter((c) => !c.resolved).length);
      return next;
    });
    await fetch(`/api/v1/scripts/${scriptId}/comments?commentId=${id}`, {
      method: "DELETE",
      headers,
    });
  };

  const openComments     = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}

      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 320,
          background: bg,
          borderLeft: `1px solid ${border}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.18)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={14} style={{ color: textSub }} />
            <span className="text-[13px] font-medium" style={{ color: textMain }}>Comentarios</span>
            {openComments.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums"
                style={{ background: "rgba(139,92,246,0.15)", color: "rgb(167,139,250)" }}>
                {openComments.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: textSub }}>
            <X size={13} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 size={16} className="animate-spin" style={{ color: textSub }} />
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare size={20} className="mx-auto mb-2" style={{ color: textSub, opacity: 0.3 }} />
              <p className="text-[12px]" style={{ color: textSub }}>Sin comentarios aún</p>
              <p className="text-[11px] mt-1" style={{ color: textSub, opacity: 0.6 }}>Sé el primero en comentar</p>
            </div>
          )}

          {openComments.map((c) => (
            <CommentCard key={c.id} comment={c} textMain={textMain} textSub={textSub}
              hoverBg={hoverBg} border={border}
              onResolve={() => handleResolve(c.id, c.resolved)}
              onDelete={() => handleDelete(c.id)} />
          ))}

          {resolvedComments.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider pt-3 pb-1" style={{ color: textSub }}>
                Resueltos · {resolvedComments.length}
              </p>
              {resolvedComments.map((c) => (
                <CommentCard key={c.id} comment={c} textMain={textMain} textSub={textSub}
                  hoverBg={hoverBg} border={border}
                  onResolve={() => handleResolve(c.id, c.resolved)}
                  onDelete={() => handleDelete(c.id)}
                  dimmed />
              ))}
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Agregar comentario…"
              rows={3}
              className="w-full bg-transparent outline-none resize-none text-[13px] px-3 pt-3 pb-2"
              style={{ color: textMain, fontFamily: "inherit" }}
            />
            <div className="flex justify-end px-2 pb-2">
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                style={{ background: "rgba(139,92,246,0.15)", color: "rgb(167,139,250)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Comentar
              </button>
            </div>
          </div>
          {submitError
            ? <p className="text-[10px] mt-1.5 text-center text-red-400">Error al enviar. Intentá de nuevo.</p>
            : <p className="text-[10px] mt-1.5 text-center" style={{ color: textSub, opacity: 0.6 }}>⌘↵ para enviar</p>
          }
        </div>
      </div>
    </>
  );
}
