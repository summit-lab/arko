"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, ChevronDown, Maximize2, Download } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES, CONTENT_TYPES, CONTENT_PLATFORMS } from "@/types/content-plan";
import type {
  ContentItem,
  ContentType,
  ContentStatus,
  ContentPlatform,
  ContentStatusMeta,
} from "@/types/content-plan";

// ─── Local UI components ───────────────────────────────────────────────────────

interface PillGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  isLight: boolean;
  textMain: string;
  textSub: string;
  border: string;
}

function PillGroup<T extends string>({
  options, value, onChange, isLight, textMain, textSub, border,
}: PillGroupProps<T>) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: active
                ? isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.12)"
                : isLight ? "rgba(17,17,17,0.03)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${active
                ? isLight ? "rgba(17,17,17,0.22)" : "rgba(255,255,255,0.20)"
                : border}`,
              color: active ? textMain : textSub,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface StatusSelectProps {
  options: ContentStatusMeta[];
  value: ContentStatus;
  onChange: (v: ContentStatus) => void;
  isLight: boolean;
  textMain: string;
  textSub: string;
  border: string;
  inputBg: string;
}

function StatusSelect({
  options, value, onChange, isLight, textMain, textSub, border, inputBg,
}: StatusSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMeta = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dropdownBg = isLight ? "white" : "rgba(16,16,18,0.99)";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-left transition-all"
        style={{
          background: inputBg,
          border: `1px solid ${open
            ? isLight ? "rgba(17,17,17,0.30)" : "rgba(255,255,255,0.22)"
            : border}`,
          color: textMain,
        }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: currentMeta.dot }}
        />
        <span className="flex-1">{currentMeta.label}</span>
        <ChevronDown
          size={13}
          style={{
            color: textSub,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl p-1.5 overflow-hidden"
          style={{
            background: dropdownBg,
            border: `1px solid ${border}`,
            boxShadow: isLight
              ? "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)"
              : "0 8px 32px rgba(0,0,0,0.55)",
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all text-left"
                style={{
                  background: active
                    ? isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.07)"
                    : "transparent",
                  color: active ? textMain : textSub,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background =
                    isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: opt.dot }}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ContentItemModalProps {
  item: ContentItem | null;
  defaultStatus?: ContentStatus;
  onClose: () => void;
  onCreate: (data: CreatePayload) => Promise<void>;
  onUpdate: (id: string, data: Partial<CreatePayload>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface CreatePayload {
  title: string;
  content_type: ContentType;
  status: ContentStatus;
  platform: ContentPlatform;
  planned_date: string | null;
  description: string | null;
  script: string | null;
}

export function ContentItemModal({
  item,
  defaultStatus = "idea",
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: ContentItemModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isEdit = !!item;

  const [title, setTitle]             = useState(item?.title ?? "");
  const [contentType, setContentType] = useState<ContentType>(item?.content_type ?? "reel");
  const [status, setStatus]           = useState<ContentStatus>(item?.status ?? defaultStatus);
  const [platform, setPlatform]       = useState<ContentPlatform>(item?.platform ?? "instagram");
  const [plannedDate, setPlannedDate] = useState(item?.planned_date ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [script, setScript]           = useState(item?.script ?? "");
  const [titleError, setTitleError]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);

  const titleRef      = useRef<HTMLInputElement>(null);
  const scriptRef     = useRef<HTMLTextAreaElement>(null);
  const scriptExpRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return; }
    setSaving(true);
    try {
      const payload: CreatePayload = {
        title: title.trim(),
        content_type: contentType,
        status,
        platform,
        planned_date: plannedDate || null,
        description: description.trim() || null,
        script: script.trim() || null,
      };
      if (isEdit) await onUpdate(item.id, payload);
      else await onCreate(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  }

  function downloadScript() {
    if (!script.trim()) return;
    const safeName = (title || "script").replace(/[<>:"/\\|?*]/g, "").trim() || "script";

    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const bodyLines = script
      .split("\n")
      .map((line) => line.trim() ? `<p>${escHtml(line)}</p>` : "<p>&nbsp;</p>")
      .join("\n");

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="UTF-8">
<title>${escHtml(safeName)}</title>
<style>
body { font-family: Calibri, Arial, sans-serif; font-size: 13pt; line-height: 1.8; margin: 2.5cm; color: #111; }
h1  { font-size: 18pt; font-weight: 600; margin-bottom: 1.2em; }
p   { margin: 0 0 0.6em 0; }
</style>
</head>
<body>
<h1>${escHtml(safeName)}</h1>
${bodyLines}
</body>
</html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${safeName}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openScriptExpanded() {
    setScriptExpanded(true);
    setTimeout(() => scriptExpRef.current?.focus(), 50);
  }

  // Theme tokens
  const modalBg     = isLight ? "#ffffff" : "rgba(14,14,16,0.97)";
  const borderColor = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.09)";
  const textMain    = isLight ? "#111111" : "rgba(255,255,255,0.88)";
  const textSub     = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const labelColor  = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.35)";
  const inputBg     = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
  const inputBorderNormal = isLight ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.08)";
  const inputBorderFocus  = isLight ? "rgba(17,17,17,0.30)" : "rgba(255,255,255,0.22)";

  const inputStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${titleError ? "rgba(239,68,68,0.5)" : inputBorderNormal}`,
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    color: textMain,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: labelColor,
    marginBottom: 6,
  };

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col scrollbar-none"
        style={{
          background: modalBg,
          border: `1px solid ${borderColor}`,
          boxShadow: isLight
            ? "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)"
            : "0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: textMain }}>
            {isEdit ? "Editar contenido" : "Nuevo contenido"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: textSub }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = inputBg}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Title */}
          <div>
            <label style={labelStyle}>Título</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              placeholder="¿De qué trata este contenido?"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = titleError ? "rgba(239,68,68,0.5)" : inputBorderNormal)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            {titleError && (
              <p className="text-[11px] text-red-500 mt-1">El título es obligatorio.</p>
            )}
          </div>

          {/* Type — pill buttons */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <PillGroup
              options={CONTENT_TYPES}
              value={contentType}
              onChange={setContentType}
              isLight={isLight}
              textMain={textMain}
              textSub={textSub}
              border={inputBorderNormal}
            />
          </div>

          {/* Status + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Estado</label>
              <StatusSelect
                options={CONTENT_STATUSES}
                value={status}
                onChange={setStatus}
                isLight={isLight}
                textMain={textMain}
                textSub={textSub}
                border={inputBorderNormal}
                inputBg={inputBg}
              />
            </div>
            <div>
              <label style={labelStyle}>Fecha objetivo</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                style={{
                  ...inputStyle,
                  colorScheme: isLight ? "light" : "dark",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
                onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
              />
            </div>
          </div>

          {/* Platform — pill buttons */}
          <div>
            <label style={labelStyle}>Plataforma</label>
            <PillGroup
              options={CONTENT_PLATFORMS}
              value={platform}
              onChange={setPlatform}
              isLight={isLight}
              textMain={textMain}
              textSub={textSub}
              border={inputBorderNormal}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notas / brief</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, referencias, ideas sueltas…"
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
            />
          </div>

          {/* Script */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label style={{ ...labelStyle, marginBottom: 0 }}>Script / caption</label>
              <div className="flex items-center gap-1">
                {script.trim() && (
                  <button
                    type="button"
                    onClick={downloadScript}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all"
                    style={{ color: textSub, background: "transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = inputBg; (e.currentTarget as HTMLElement).style.color = labelColor; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
                    title="Descargar script"
                  >
                    <Download size={11} />
                    <span>Descargar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openScriptExpanded}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all"
                  style={{ color: textSub, background: "transparent" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = inputBg; (e.currentTarget as HTMLElement).style.color = labelColor; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = textSub; }}
                  title="Ver en modo grabación"
                >
                  <Maximize2 size={11} />
                  <span>Expandir</span>
                </button>
              </div>
            </div>
            <textarea
              ref={scriptRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Escribí el guion o caption completo…"
              rows={5}
              style={{ ...inputStyle, resize: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
            />
          </div>

          {/* Metrics (published only) */}
          {isEdit && item.status === "published" && item.metrics && (
            <div
              className="rounded-xl p-3"
              style={{ background: inputBg, border: `1px solid ${borderColor}` }}
            >
              <p style={labelStyle}>Métricas</p>
              <div className="grid grid-cols-3 gap-3">
                {(["reach", "likes", "saves", "comments", "shares"] as const).map((k) => {
                  const v = item.metrics?.[k];
                  if (!v) return null;
                  const labels = {
                    reach: "Alcance", likes: "Likes", saves: "Guardados",
                    comments: "Comentarios", shares: "Compartidos",
                  };
                  return (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: textSub }}>{labels[k]}</p>
                      <p className="text-[15px] font-light" style={{ color: textMain }}>{v.toLocaleString("es-AR")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 pb-5 pt-3 flex items-center justify-between gap-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[13px] transition-colors"
              style={{ color: confirmDelete ? "rgb(239,68,68)" : textSub }}
            >
              <Trash2 size={13} />
              {deleting ? "Eliminando…" : confirmDelete ? "¿Confirmar?" : "Eliminar"}
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] transition-all"
              style={{ color: textSub }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50"
              style={{
                background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.12)",
                color: isLight ? "white" : "rgba(255,255,255,0.9)",
              }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* ── Script fullscreen overlay ── */}
      {scriptExpanded && (
        <div
          className="fixed inset-0 z-[60] flex flex-col"
          style={{
            background: isLight ? "#fafafa" : "rgba(8,8,10,0.98)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-6 py-3 shrink-0"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <div>
              <p className="text-[13px] font-semibold" style={{ color: textMain }}>
                Modo grabación
              </p>
              {title && (
                <p className="text-[12px] mt-0.5" style={{ color: textSub }}>{title}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {script.trim() && (
                <button
                  onClick={downloadScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
                  style={{
                    background: inputBg,
                    border: `1px solid ${borderColor}`,
                    color: textSub,
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
                >
                  <Download size={12} />
                  Descargar
                </button>
              )}
              <button
                onClick={() => setScriptExpanded(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
                style={{
                  background: inputBg,
                  border: `1px solid ${borderColor}`,
                  color: textSub,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
              >
                <X size={12} />
                Cerrar
              </button>
            </div>
          </div>

          {/* Script editor — large font for reading while recording */}
          <div className="flex-1 overflow-hidden px-8 py-8">
            <textarea
              ref={scriptExpRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Escribí el guion aquí…"
              className="w-full h-full resize-none bg-transparent outline-none leading-relaxed scrollbar-none"
              style={{
                fontSize: 22,
                lineHeight: 1.75,
                color: textMain,
                letterSpacing: "0.01em",
                fontWeight: 300,
              }}
            />
          </div>

          {/* Stats bar */}
          <div
            className="px-8 py-3 shrink-0 flex items-center gap-4"
            style={{ borderTop: `1px solid ${borderColor}` }}
          >
            <p className="text-[11px]" style={{ color: textSub }}>
              {script.trim().split(/\s+/).filter(Boolean).length} palabras
            </p>
            <p className="text-[11px]" style={{ color: textSub }}>
              {script.length} caracteres
            </p>
            <p className="text-[11px]" style={{ color: textSub }}>
              ~{Math.ceil(script.trim().split(/\s+/).filter(Boolean).length / 130)} min de lectura
            </p>
          </div>
        </div>
      )}
    </>
  );
}
