"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, History, RotateCcw, Sparkles, User as UserIcon, Server } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";

interface Version {
  id: string;
  title: string | null;
  script: string | null;
  changed_by_kind: "user" | "moka" | "system" | "unknown";
  change_reason: string | null;
  source_session: string | null;
  created_at: string;
}

interface ScriptHistoryModalProps {
  open: boolean;
  onClose: () => void;
  contentPlanId: string;
  workspaceId: string;
  currentScript: string;
  onRestored: (newScript: string, newTitle?: string) => void;
}

function htmlToPreview(html: string, maxLen = 280): string {
  if (!html) return "";
  const text = html
    .replace(/<\/(p|h[1-6]|li|div|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n+/g, "\n")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

function authorLabel(kind: Version["changed_by_kind"]): string {
  switch (kind) {
    case "user":   return "Vos";
    case "moka":   return "Moka AI";
    case "system": return "Sistema";
    default:       return "Desconocido";
  }
}

function AuthorIcon({ kind, size = 12 }: { kind: Version["changed_by_kind"]; size?: number }) {
  if (kind === "moka")   return <Sparkles size={size} />;
  if (kind === "system") return <Server size={size} />;
  return <UserIcon size={size} />;
}

export function ScriptHistoryModal({
  open,
  onClose,
  contentPlanId,
  workspaceId,
  currentScript,
  onRestored,
}: ScriptHistoryModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo");
  const locale = useLocale();

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/content-plan/${contentPlanId}/versions`, {
        headers: { "x-workspace-id": workspaceId },
      });
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setVersions(data?.data?.versions ?? []);
    } catch {
      setError(t("history.loadError"));
    } finally {
      setLoading(false);
    }
  }, [contentPlanId, workspaceId, t]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      void fetchVersions();
    }
  }, [open, fetchVersions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleRestore = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(t("history.restoreConfirm"))) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/v1/content-plan/${contentPlanId}/versions/${selected.id}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
          body: JSON.stringify({ restoreTitle: false }),
        }
      );
      if (!res.ok) throw new Error("restore_failed");
      const data = await res.json();
      const newItem = data?.data?.item as { script?: string; title?: string } | undefined;
      onRestored(newItem?.script ?? selected.script ?? "", newItem?.title);
      onClose();
    } catch {
      setError(t("history.restoreError"));
    } finally {
      setRestoring(false);
    }
  }, [selected, contentPlanId, workspaceId, onRestored, onClose, t]);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-AR", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    }),
    [locale]
  );

  if (!open) return null;

  const border    = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.10)";
  const panelBg   = isLight ? "#ffffff"             : "rgba(20,20,22,0.98)";
  const sectionBg = isLight ? "rgba(17,17,17,0.03)" : "rgba(255,255,255,0.03)";
  const textMain  = isLight ? "#111111"             : "rgba(255,255,255,0.92)";
  const textSub   = isLight ? "rgba(17,17,17,0.55)" : "rgba(255,255,255,0.50)";
  const labelCol  = isLight ? "rgba(17,17,17,0.40)" : "rgba(255,255,255,0.32)";
  const hoverBg   = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const activeBg  = isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: panelBg,
          border: `1px solid ${border}`,
          maxHeight: "85vh",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${border}` }}
        >
          <div className="flex items-center gap-2.5">
            <History size={16} style={{ color: textSub }} />
            <div>
              <p className="text-[14px] font-medium" style={{ color: textMain }}>{t("history.title")}</p>
              <p className="text-[11.5px]" style={{ color: textSub }}>{t("history.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ color: textSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body: lista | preview */}
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)" }}>
          {/* Lista */}
          <div
            className="overflow-y-auto p-2 scrollbar-none"
            style={{ borderRight: `1px solid ${border}`, background: sectionBg }}
          >
            {loading && (
              <p className="text-[12px] px-3 py-4" style={{ color: textSub }}>{t("history.loading")}</p>
            )}
            {error && (
              <p className="text-[12px] px-3 py-4" style={{ color: "rgb(239,68,68)" }}>{error}</p>
            )}
            {!loading && !error && versions.length === 0 && (
              <p className="text-[12px] px-3 py-4" style={{ color: textSub }}>{t("history.empty")}</p>
            )}
            {versions.map((v) => {
              const isActive = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors"
                  style={{
                    background: isActive ? activeBg : "transparent",
                    border: `1px solid ${isActive ? border : "transparent"}`,
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-1.5 mb-1" style={{ color: textSub }}>
                    <AuthorIcon kind={v.changed_by_kind} />
                    <span className="text-[11px] font-medium">{authorLabel(v.changed_by_kind)}</span>
                    <span style={{ color: labelCol }}>·</span>
                    <span className="text-[11px]">{dateFmt.format(new Date(v.created_at))}</span>
                  </div>
                  <p className="text-[12px] line-clamp-2" style={{ color: textMain }}>
                    {v.title || t("scripts.untitled")}
                  </p>
                  {v.change_reason && (
                    <p className="text-[10.5px] mt-1 uppercase tracking-wide" style={{ color: labelCol }}>
                      {v.change_reason}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="overflow-y-auto p-5 scrollbar-none">
            {!selected ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[12.5px]" style={{ color: textSub }}>{t("history.selectVersion")}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-2" style={{ color: textSub }}>
                  <AuthorIcon kind={selected.changed_by_kind} size={13} />
                  <span className="text-[12px] font-medium">{authorLabel(selected.changed_by_kind)}</span>
                  <span style={{ color: labelCol }}>·</span>
                  <span className="text-[12px]">{dateFmt.format(new Date(selected.created_at))}</span>
                </div>
                {selected.title && (
                  <h3 className="text-[18px] font-semibold mb-3" style={{ color: textMain }}>
                    {selected.title}
                  </h3>
                )}
                <div
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: textMain }}
                >
                  {htmlToPreview(selected.script ?? "", 5000)}
                </div>
                {(selected.script ?? "") === currentScript && (
                  <p className="text-[11px] mt-4 italic" style={{ color: textSub }}>
                    {t("history.sameAsCurrent")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: `1px solid ${border}` }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12.5px] transition-colors"
            style={{ color: textSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {t("modal.cancel")}
          </button>
          <button
            onClick={handleRestore}
            disabled={!selected || restoring || (selected?.script ?? "") === currentScript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.12)",
              color: isLight ? "white" : "rgba(255,255,255,0.9)",
            }}
          >
            <RotateCcw size={12} />
            {restoring ? t("history.restoring") : t("history.restore")}
          </button>
        </div>
      </div>
    </div>
  );
}
