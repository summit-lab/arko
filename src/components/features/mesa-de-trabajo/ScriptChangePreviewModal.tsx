"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Check, Sparkles, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";

interface PendingChange {
  id: string;
  content_plan_id: string;
  base_script: string | null;
  base_title: string | null;
  proposed_script: string | null;
  proposed_title: string | null;
  rationale: string | null;
}

interface ScriptChangePreviewModalProps {
  pending: PendingChange | null;
  workspaceId: string;
  onApply: (newScript: string, newTitle: string | null) => void;
  onReject: () => void;
  onClose: () => void;
}

// ─── Helpers de diff ──────────────────────────────────────────────────────────

function htmlToPlainLines(html: string | null): string[] {
  if (!html) return [];
  const txt = html
    .replace(/<\/(p|h[1-6]|li|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return txt.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

type DiffLine = { type: "same" | "added" | "removed"; text: string };

/** Diff por líneas con LCS clásico. */
function diffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      out.push({ type: "same", text: oldLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "removed", text: oldLines[i] });
      i++;
    } else {
      out.push({ type: "added", text: newLines[j] });
      j++;
    }
  }
  while (i < m) { out.push({ type: "removed", text: oldLines[i++] }); }
  while (j < n) { out.push({ type: "added",   text: newLines[j++] }); }
  return out;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ScriptChangePreviewModal({
  pending,
  workspaceId,
  onApply,
  onReject,
  onClose,
}: ScriptChangePreviewModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo.diffPreview");

  const [applying, setApplying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cerrar sin acción = auto-reject silencioso para que la propuesta no quede
  // colgada en DB consumiendo el slot del usuario.
  const closeAndAutoReject = useCallback(async () => {
    const id = pending?.id;
    if (id) {
      // Fire-and-forget — no esperamos al server para cerrar
      void fetch(`/api/v1/script-changes/${id}/reject`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      }).catch(() => { /* silent */ });
    }
    onClose();
  }, [pending?.id, workspaceId, onClose]);

  // Cerrar con ESC = auto-reject
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeAndAutoReject(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, closeAndAutoReject]);

  const baseLines     = useMemo(() => htmlToPlainLines(pending?.base_script ?? null),     [pending]);
  const proposedLines = useMemo(() => htmlToPlainLines(pending?.proposed_script ?? null), [pending]);
  const diff          = useMemo(() => diffLines(baseLines, proposedLines),                [baseLines, proposedLines]);

  const titleChanged = !!pending && pending.proposed_title !== null
    && pending.proposed_title !== pending.base_title;

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    for (const d of diff) {
      if (d.type === "added")   added++;
      else if (d.type === "removed") removed++;
    }
    return { added, removed };
  }, [diff]);

  const handleApply = useCallback(async () => {
    if (!pending || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/script-changes/${pending.id}/apply`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      if (!res.ok) throw new Error("apply_failed");
      const data = await res.json();
      const item = data?.data?.item as { script?: string; title?: string | null } | undefined;
      onApply(item?.script ?? pending.proposed_script ?? "", item?.title ?? pending.proposed_title);
    } catch {
      setError(t("applyError"));
      setApplying(false);
    }
  }, [pending, workspaceId, applying, onApply, t]);

  const handleReject = useCallback(async () => {
    if (!pending || rejecting) return;
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/script-changes/${pending.id}/reject`, {
        method: "POST",
        headers: { "x-workspace-id": workspaceId },
      });
      if (!res.ok) throw new Error("reject_failed");
      onReject();
    } catch {
      setError(t("rejectError"));
      setRejecting(false);
    }
  }, [pending, workspaceId, rejecting, onReject, t]);

  if (!pending) return null;

  const border    = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)";
  const panelBg   = isLight ? "#ffffff"             : "rgba(20,20,22,0.98)";
  const sectionBg = isLight ? "rgba(17,17,17,0.02)" : "rgba(255,255,255,0.02)";
  const textMain  = isLight ? "#111111"             : "rgba(255,255,255,0.92)";
  const textSub   = isLight ? "rgba(17,17,17,0.55)" : "rgba(255,255,255,0.50)";
  const labelCol  = isLight ? "rgba(17,17,17,0.40)" : "rgba(255,255,255,0.32)";
  const hoverBg   = isLight ? "rgba(17,17,17,0.05)" : "rgba(255,255,255,0.05)";
  const addedBg   = isLight ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.16)";
  const addedText = isLight ? "rgb(21,128,61)"       : "rgba(134,239,172,0.95)";
  const remBg     = isLight ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.14)";
  const remText   = isLight ? "rgb(153,27,27)"       : "rgba(252,165,165,0.95)";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-preview-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!applying && !rejecting) closeAndAutoReject(); }}
      />

      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${border}`,
          maxHeight: "88vh",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.15)" }}
            >
              <Sparkles size={14} style={{ color: "rgb(139,92,246)" }} />
            </div>
            <div>
              <p id="diff-preview-title" className="text-[14px] font-medium" style={{ color: textMain }}>{t("title")}</p>
              <p className="text-[11.5px]" style={{ color: textSub }}>{t("subtitle")}</p>
            </div>
          </div>
          <button
            onClick={closeAndAutoReject}
            disabled={applying || rejecting}
            aria-label={t("reject")}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ color: textSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Rationale + stats */}
        {(pending.rationale || stats.added + stats.removed > 0 || titleChanged) && (
          <div
            className="px-5 py-3 shrink-0 flex items-start gap-3"
            style={{ borderBottom: `1px solid ${border}`, background: sectionBg }}
          >
            {pending.rationale && (
              <p className="flex-1 text-[12.5px] leading-relaxed" style={{ color: textMain }}>
                {pending.rationale}
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {stats.added > 0 && (
                <span className="text-[11px] tabular-nums px-2 py-0.5 rounded"
                  style={{ background: addedBg, color: addedText }}>+{stats.added}</span>
              )}
              {stats.removed > 0 && (
                <span className="text-[11px] tabular-nums px-2 py-0.5 rounded"
                  style={{ background: remBg, color: remText }}>−{stats.removed}</span>
              )}
            </div>
          </div>
        )}

        {/* Title diff */}
        {titleChanged && (
          <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
            <p className="text-[10.5px] uppercase tracking-widest mb-1.5" style={{ color: labelCol }}>
              {t("titleLabel")}
            </p>
            <p className="text-[13px] line-through mb-0.5" style={{ color: remText, background: remBg, padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
              {pending.base_title || t("untitledPlaceholder")}
            </p>
            <br />
            <p className="text-[13px]" style={{ color: addedText, background: addedBg, padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
              {pending.proposed_title}
            </p>
          </div>
        )}

        {/* Diff side-by-side */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: `1px solid ${border}` }}>
          <div
            className="overflow-y-auto p-4 scrollbar-none border-b md:border-b-0 md:border-r"
            style={{ borderColor: border, background: sectionBg }}
          >
            <p className="text-[10.5px] uppercase tracking-widest mb-2 sticky top-0 pb-2"
              style={{ color: labelCol, background: sectionBg }}>
              {t("current")}
            </p>
            <div className="flex flex-col gap-1">
              {diff.map((d, i) => {
                if (d.type === "added") return null;
                const isRemoved = d.type === "removed";
                return (
                  <div
                    key={`l-${i}`}
                    className="text-[12.5px] leading-relaxed px-2 py-1 rounded"
                    style={{
                      background: isRemoved ? remBg : "transparent",
                      color: isRemoved ? remText : textMain,
                      textDecoration: isRemoved ? "line-through" : "none",
                    }}
                  >
                    {d.text}
                  </div>
                );
              })}
              {baseLines.length === 0 && (
                <p className="text-[12px] italic" style={{ color: textSub }}>{t("emptyPlaceholder")}</p>
              )}
            </div>
          </div>
          <div className="overflow-y-auto p-4 scrollbar-none">
            <p className="text-[10.5px] uppercase tracking-widest mb-2 sticky top-0 pb-2"
              style={{ color: labelCol, background: panelBg }}>
              {t("proposed")}
            </p>
            <div className="flex flex-col gap-1">
              {diff.map((d, i) => {
                if (d.type === "removed") return null;
                const isAdded = d.type === "added";
                return (
                  <div
                    key={`r-${i}`}
                    className="text-[12.5px] leading-relaxed px-2 py-1 rounded"
                    style={{
                      background: isAdded ? addedBg : "transparent",
                      color: isAdded ? addedText : textMain,
                    }}
                  >
                    {d.text}
                  </div>
                );
              })}
              {proposedLines.length === 0 && (
                <p className="text-[12px] italic" style={{ color: textSub }}>{t("emptyPlaceholder")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 shrink-0">
          {error ? (
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "rgb(239,68,68)" }}>
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={applying || rejecting}
              className="px-3 py-1.5 rounded-md text-[12.5px] transition-colors disabled:opacity-40"
              style={{ color: textSub }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {rejecting ? t("rejecting") : t("reject")}
            </button>
            <button
              onClick={handleApply}
              disabled={applying || rejecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all disabled:opacity-40"
              style={{
                background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.12)",
                color: isLight ? "white" : "rgba(255,255,255,0.9)",
              }}
            >
              <Check size={12} />
              {applying ? t("applying") : t("apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
