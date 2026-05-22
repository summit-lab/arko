"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Trash2, X, MessageSquare, MessageSquareOff, AlertCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ScriptEditorV2Handle } from "./ScriptEditorV2";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface InlineComment {
  id: string;
  author_name: string;
  user_id: string | null;
  text: string;
  resolved: boolean;
  comment_id: string | null;       // matchea data-comment-id en el editor
  anchor_quoted: string | null;    // snapshot del texto al crear
  created_at: string;
}

interface ScriptInlineCommentsPanelProps {
  scriptId: string;
  workspaceId: string;
  editorRef: React.RefObject<ScriptEditorV2Handle | null>;
  /** Lista completa de comments — ScriptPage es el single source of truth. */
  comments: InlineComment[];
  /** Para callbacks de mutación que actualizan el state en ScriptPage. */
  onCommentsChange: (next: InlineComment[]) => void;
  /** Cuando cambia el HTML del editor (afecta anchorTops). Pasar un valor estable
   *  como `${item.id}:${charCountAproximado}` — NO el HTML completo. */
  scriptVersion: string;
  /** Comment ID que viene del editor cuando el usuario clickea un highlight. */
  highlightedCommentId: string | null;
  /** Para que ScriptPage pueda limpiar el highlight (click fuera, resolve, etc.). */
  onHighlightChange: (commentId: string | null) => void;
  /** Comment ID provisional cuando el usuario acaba de crear una marca pero todavía no escribió texto. */
  draftCommentId: string | null;
  draftQuotedText: string | null;
  /** Llamado cuando el draft se confirma o se cancela. */
  onDraftResolved: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return locale === "en" ? "now"      : "ahora";
  if (mins < 60) return locale === "en" ? `${mins}m ago`  : `hace ${mins}m`;
  if (hours < 24) return locale === "en" ? `${hours}h ago` : `hace ${hours}h`;
  if (days < 7)   return locale === "en" ? `${days}d ago`  : `hace ${days}d`;
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-AR", { day: "numeric", month: "short" });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function ScriptInlineCommentsPanel({
  scriptId,
  workspaceId,
  editorRef,
  comments,
  onCommentsChange,
  scriptVersion,
  highlightedCommentId,
  onHighlightChange,
  draftCommentId,
  draftQuotedText,
  onDraftResolved,
}: ScriptInlineCommentsPanelProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo.inlineComments");
  const locale = useLocale();

  const [draftText, setDraftText] = useState("");
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Map<commentId, topPx> — calculado del DOM. Debounced para no recalcular en cada tecla.
  const [anchorTops, setAnchorTops] = useState<Map<string, number>>(new Map());
  const recalcTimer = useRef<number | null>(null);

  const draftInputRef = useRef<HTMLTextAreaElement>(null);

  // Recalcular anchors con debounce (300ms) para evitar querySelectorAll en cada tecla.
  useEffect(() => {
    if (!editorRef.current) return;
    if (recalcTimer.current) window.clearTimeout(recalcTimer.current);
    recalcTimer.current = window.setTimeout(() => {
      const rects = editorRef.current?.getCommentAnchorRects() ?? [];
      setAnchorTops(new Map(rects.map((r) => [r.commentId, r.top])));
    }, 300);
    return () => {
      if (recalcTimer.current) window.clearTimeout(recalcTimer.current);
    };
  }, [scriptVersion, comments.length, editorRef]);

  // Focus en el textarea del draft cuando aparece
  useEffect(() => {
    if (draftCommentId && draftInputRef.current) {
      draftInputRef.current.focus();
      setDraftText("");
    }
  }, [draftCommentId]);

  // Limpiar el highlight si el comentario destacado ya no existe (fue eliminado/resuelto)
  useEffect(() => {
    if (highlightedCommentId && !comments.some((c) => c.comment_id === highlightedCommentId)) {
      onHighlightChange(null);
    }
  }, [comments, highlightedCommentId, onHighlightChange]);

  // Click fuera del panel/editor → limpiar highlight
  useEffect(() => {
    if (!highlightedCommentId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Si el click es dentro de una marca o de una card del panel, no limpiar.
      if (target.closest("[data-comment-id]")) return;
      if (target.closest("[data-comment-card]")) return;
      onHighlightChange(null);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [highlightedCommentId, onHighlightChange]);

  const visibleComments = useMemo(() => {
    return comments.filter((c) => showResolved || !c.resolved);
  }, [comments, showResolved]);

  const resolvedCount = useMemo(() => comments.filter((c) => c.resolved).length, [comments]);

  // Comentarios huérfanos (tienen comment_id pero la marca no existe en el DOM)
  const orphanCount = useMemo(
    () => comments.filter((c) => !c.resolved && c.comment_id && !anchorTops.has(c.comment_id)).length,
    [comments, anchorTops],
  );

  // ─── Acciones ──────────────────────────────────────────────────────────────

  const submitDraft = useCallback(async () => {
    if (!draftCommentId || !draftText.trim() || submittingDraft) return;
    setSubmittingDraft(true);
    try {
      const res = await fetch(`/api/v1/scripts/${scriptId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({
          text: draftText.trim(),
          commentId: draftCommentId,
          anchorQuoted: draftQuotedText ?? null,
        }),
      });
      if (!res.ok) throw new Error("create_failed");
      const data = await res.json();
      const newComment = data?.data?.comment as InlineComment | undefined;
      if (newComment) {
        onCommentsChange([...comments, newComment]);
      }
      setDraftText("");
      onDraftResolved();
    } catch {
      // Mantener el draft para que el usuario reintente
    } finally {
      setSubmittingDraft(false);
    }
  }, [draftCommentId, draftText, draftQuotedText, scriptId, workspaceId, submittingDraft, onDraftResolved, comments, onCommentsChange]);

  const cancelDraft = useCallback(() => {
    // Si cancela, removemos la marca del editor (no quedó persistida).
    if (draftCommentId) editorRef.current?.removeCommentMark(draftCommentId);
    setDraftText("");
    onDraftResolved();
  }, [draftCommentId, editorRef, onDraftResolved]);

  const toggleResolved = useCallback(async (comment: InlineComment) => {
    const newResolved = !comment.resolved;
    // Optimistic
    onCommentsChange(comments.map((c) => c.id === comment.id ? { ...c, resolved: newResolved } : c));
    try {
      const res = await fetch(`/api/v1/scripts/${scriptId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({ commentId: comment.id, resolved: newResolved }),
      });
      if (!res.ok) throw new Error();
      // Si era el highlighted y se acaba de resolver, limpiar.
      if (newResolved && highlightedCommentId === comment.comment_id) {
        onHighlightChange(null);
      }
      // NO removemos la marca del editor al resolver — preservar el ancla por si
      // el usuario reabre. La marca se oculta visualmente via CSS class si el
      // comentario está resolved. (Trade-off: el highlight sigue visible aunque
      // el comentario esté resuelto. Aceptable porque puede reabrirse.)
    } catch {
      onCommentsChange(comments.map((c) => c.id === comment.id ? { ...c, resolved: comment.resolved } : c));
    }
  }, [comments, onCommentsChange, scriptId, workspaceId, highlightedCommentId, onHighlightChange]);

  const deleteComment = useCallback(async (comment: InlineComment) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const prevComments = comments;
    onCommentsChange(comments.filter((c) => c.id !== comment.id));
    try {
      const res = await fetch(`/api/v1/scripts/${scriptId}/comments?commentId=${comment.id}`, {
        method: "DELETE",
        headers: { "x-workspace-id": workspaceId },
      });
      if (!res.ok) throw new Error();
      if (comment.comment_id) editorRef.current?.removeCommentMark(comment.comment_id);
      if (highlightedCommentId === comment.comment_id) onHighlightChange(null);
    } catch {
      onCommentsChange(prevComments);
    }
  }, [comments, onCommentsChange, scriptId, workspaceId, editorRef, t, highlightedCommentId, onHighlightChange]);

  // Limpieza de huérfanos: elimina todos los comentarios cuya marca ya no existe.
  const cleanOrphans = useCallback(async () => {
    const orphans = comments.filter((c) => !c.resolved && c.comment_id && !anchorTops.has(c.comment_id));
    if (orphans.length === 0) return;
    if (!window.confirm(t("cleanOrphansConfirm", { count: orphans.length }))) return;
    const prev = comments;
    onCommentsChange(comments.filter((c) => !orphans.some((o) => o.id === c.id)));
    try {
      await Promise.all(
        orphans.map((o) =>
          fetch(`/api/v1/scripts/${scriptId}/comments?commentId=${o.id}`, {
            method: "DELETE",
            headers: { "x-workspace-id": workspaceId },
          }),
        ),
      );
    } catch {
      onCommentsChange(prev);
    }
  }, [comments, anchorTops, onCommentsChange, scriptId, workspaceId, t]);

  const handleCardClick = useCallback((comment: InlineComment) => {
    if (comment.comment_id) {
      editorRef.current?.scrollToComment(comment.comment_id);
      onHighlightChange(comment.comment_id);
    }
  }, [editorRef, onHighlightChange]);

  const handleCardKey = useCallback((e: React.KeyboardEvent, comment: InlineComment) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(comment);
    }
  }, [handleCardClick]);

  // ─── Theme tokens ──────────────────────────────────────────────────────────

  const border   = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const cardBg   = isLight ? "#ffffff"              : "rgba(255,255,255,0.03)";
  const textMain = isLight ? "#111111"              : "rgba(255,255,255,0.92)";
  const textSub  = isLight ? "rgba(17,17,17,0.50)" : "rgba(255,255,255,0.42)";
  const labelCol = isLight ? "rgba(17,17,17,0.40)" : "rgba(255,255,255,0.32)";
  const hoverBg  = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const activeBorder = "rgba(234,179,8,0.5)";
  const quotedBg = isLight ? "rgba(254,240,138,0.40)" : "rgba(234,179,8,0.16)";

  return (
    <aside
      className="flex flex-col overflow-hidden h-full"
      style={{ borderLeft: `1px solid ${border}`, background: isLight ? "#fafafa" : "rgba(10,10,12,1)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: textSub }} />
          <p className="text-[13px] font-medium" style={{ color: textMain }}>
            {t("title")} {visibleComments.length > 0 && <span style={{ color: textSub, fontWeight: 400 }}>· {visibleComments.length}</span>}
          </p>
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
            style={{ color: textSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            title={showResolved ? t("hideResolved") : t("showResolved")}
          >
            {showResolved ? <MessageSquareOff size={11} /> : <MessageSquare size={11} />}
            {showResolved ? t("hideResolved") : `+${resolvedCount} ${t("resolved")}`}
          </button>
        )}
      </div>

      {/* Banner de huérfanos */}
      {orphanCount > 0 && (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 shrink-0"
          style={{ background: "rgba(234,179,8,0.10)", borderBottom: `1px solid ${border}` }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: textSub }}>
            <AlertCircle size={11} />
            <span>{t("orphansBanner", { count: orphanCount })}</span>
          </div>
          <button
            onClick={() => void cleanOrphans()}
            className="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            style={{ color: textMain }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {t("cleanOrphans")}
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 flex flex-col gap-2">
        {visibleComments.length === 0 && !draftCommentId && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
            <MessageSquare size={22} style={{ color: textSub, opacity: 0.5 }} />
            <p className="text-[12px]" style={{ color: textSub }}>{t("empty")}</p>
            <p className="text-[11px]" style={{ color: labelCol }}>{t("emptyHint")}</p>
          </div>
        )}

        {/* Draft (comentario nuevo en composición) */}
        {draftCommentId && (
          <div
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{
              background: cardBg,
              border: `1px solid ${activeBorder}`,
              boxShadow: "0 4px 16px rgba(234,179,8,0.18)",
            }}
          >
            {draftQuotedText && (
              <div
                className="text-[11.5px] italic px-2 py-1 rounded border-l-2"
                style={{
                  background: quotedBg,
                  borderLeftColor: "rgba(234,179,8,0.6)",
                  color: textSub,
                }}
              >
                “{draftQuotedText.length > 140 ? draftQuotedText.slice(0, 140) + "…" : draftQuotedText}”
              </div>
            )}
            <textarea
              ref={draftInputRef}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitDraft();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelDraft();
                }
              }}
              placeholder={t("draftPlaceholder")}
              rows={3}
              maxLength={2000}
              className="w-full resize-none outline-none text-[12.5px] bg-transparent"
              style={{ color: textMain }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px]" style={{ color: labelCol }}>{t("submitHint")}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelDraft}
                  className="px-2.5 py-1 rounded text-[11.5px] transition-colors"
                  style={{ color: textSub }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => void submitDraft()}
                  disabled={!draftText.trim() || submittingDraft}
                  className="px-3 py-1 rounded text-[11.5px] font-medium transition-all disabled:opacity-40"
                  style={{
                    background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.12)",
                    color: isLight ? "white" : "rgba(255,255,255,0.92)",
                  }}
                >
                  {submittingDraft ? t("submitting") : t("submit")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comentarios existentes, ordenados por anchor top o created_at */}
        {visibleComments
          .slice()
          .sort((a, b) => {
            const ta = a.comment_id ? anchorTops.get(a.comment_id) ?? Infinity : Infinity;
            const tb = b.comment_id ? anchorTops.get(b.comment_id) ?? Infinity : Infinity;
            if (ta !== tb) return ta - tb;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          })
          .map((comment) => {
            const isHighlighted = highlightedCommentId && comment.comment_id === highlightedCommentId;
            const isOrphan = !!comment.comment_id && !anchorTops.has(comment.comment_id);
            return (
              <div
                key={comment.id}
                data-comment-card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(comment)}
                onKeyDown={(e) => handleCardKey(e, comment)}
                className="rounded-xl p-3 cursor-pointer flex flex-col gap-2 transition-all outline-none focus-visible:ring-2"
                style={{
                  background: cardBg,
                  border: `1px solid ${isHighlighted ? activeBorder : border}`,
                  boxShadow: isHighlighted ? "0 2px 8px rgba(234,179,8,0.18)" : "none",
                  opacity: comment.resolved ? 0.55 : 1,
                }}
                onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                onMouseLeave={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = cardBg; }}
              >
                {comment.anchor_quoted && (
                  <div
                    className="text-[11px] italic px-2 py-1 rounded border-l-2"
                    style={{
                      background: quotedBg,
                      borderLeftColor: isOrphan ? "rgba(150,150,150,0.5)" : "rgba(234,179,8,0.6)",
                      color: textSub,
                    }}
                  >
                    {isOrphan && <span className="not-italic mr-1" style={{ color: labelCol }}>⚠ {t("orphan")}</span>}
                    “{comment.anchor_quoted.length > 100 ? comment.anchor_quoted.slice(0, 100) + "…" : comment.anchor_quoted}”
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold"
                    style={{
                      background: isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.10)",
                      color: textMain,
                    }}
                  >
                    {initialsOf(comment.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-medium truncate" style={{ color: textMain }}>
                      {comment.author_name}
                    </p>
                    <p className="text-[10.5px]" style={{ color: labelCol }}>
                      {formatRelative(comment.created_at, locale)}
                      {comment.resolved && <span className="ml-1.5">· {t("resolvedLabel")}</span>}
                    </p>
                  </div>
                </div>

                <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: textMain }}>
                  {comment.text}
                </p>

                <div className="flex items-center justify-end gap-1 pt-1" style={{ borderTop: `1px dashed ${border}` }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); void toggleResolved(comment); }}
                    title={comment.resolved ? t("reopen") : t("resolve")}
                    className="px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                    style={{ color: textSub }}
                    onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = hoverBg; }}
                    onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {comment.resolved ? <X size={11} /> : <Check size={11} />}
                    {comment.resolved ? t("reopen") : t("resolve")}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void deleteComment(comment); }}
                    title={t("delete")}
                    className="px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                    style={{ color: textSub }}
                    onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = hoverBg; (ev.currentTarget as HTMLElement).style.color = "rgb(239,68,68)"; }}
                    onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = "transparent"; (ev.currentTarget as HTMLElement).style.color = textSub; }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
