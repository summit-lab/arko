"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, ChevronDown, Maximize2, Bold, List, Heading1, Heading2 } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
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
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: currentMeta.dot }} />
        <span className="flex-1">{currentMeta.label}</span>
        <ChevronDown size={13} style={{ color: textSub, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
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
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.dot }} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── URL input ────────────────────────────────────────────────────────────────

interface UrlFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputStyle: React.CSSProperties;
  inputBorderNormal: string;
  inputBorderFocus: string;
  labelStyle: React.CSSProperties;
}

function UrlField({ label, value, onChange, placeholder, inputStyle, inputBorderNormal, inputBorderFocus, labelStyle }: UrlFieldProps) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
        onBlur={(e)  => (e.currentTarget.style.borderColor = inputBorderNormal)}
      />
    </div>
  );
}

// ─── Script helpers ──────────────────────────────────────────────────────────

function scriptToHtml(text: string): string {
  if (!text) return '';
  if (/<(p|h[1-6]|ul|ol|li|strong|em)\b/i.test(text)) return text;
  return text.split('\n').map((l) => l.trim() ? `<p>${l}</p>` : '<p></p>').join('');
}

function scriptToPlainText(value: string): string {
  if (!value.includes('<')) return value;
  return value
    .replace(/<\/?(h[1-6])[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function countWords(value: string): number {
  return scriptToPlainText(value).split(/\s+/).filter(Boolean).length;
}

// ─── Rich text editor (tiptap) ────────────────────────────────────────────────

interface ScriptEditorProps {
  content: string;
  onChange: (html: string) => void;
  isLight: boolean;
  textMain: string;
  textSub: string;
  border: string;
  inputBg: string;
}

function ScriptEditor({ content, onChange, isLight, textMain, textSub, border, inputBg }: ScriptEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Escribí el guion aquí…' }),
    ],
    content: scriptToHtml(content),
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[60vh]',
        style: `font-size:22px;line-height:1.8;color:${textMain};font-weight:300;letter-spacing:0.01em`,
      },
    },
  });

  const toolBtn = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
      style={{
        background: active ? (isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.12)") : "transparent",
        border: `1px solid ${active ? (isLight ? "rgba(17,17,17,0.20)" : "rgba(255,255,255,0.18)") : "transparent"}`,
        color: active ? textMain : textSub,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = inputBg; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${border}` }}
      >
        {toolBtn(
          editor?.isActive('heading', { level: 1 }) ?? false,
          () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          'Título 1',
          <Heading1 size={14} />
        )}
        {toolBtn(
          editor?.isActive('heading', { level: 2 }) ?? false,
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          'Título 2',
          <Heading2 size={14} />
        )}
        {toolBtn(
          editor?.isActive('bold') ?? false,
          () => editor?.chain().focus().toggleBold().run(),
          'Negrita',
          <Bold size={14} />
        )}
        {toolBtn(
          editor?.isActive('bulletList') ?? false,
          () => editor?.chain().focus().toggleBulletList().run(),
          'Lista',
          <List size={14} />
        )}
      </div>
      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-12 py-10 scrollbar-none">
        <style>{`
          .tiptap h1 { font-size: 1.8em; font-weight: 600; margin-bottom: 0.4em; }
          .tiptap h2 { font-size: 1.4em; font-weight: 600; margin-bottom: 0.3em; }
          .tiptap ul { list-style-type: disc; padding-left: 1.5em; }
          .tiptap li { margin-bottom: 0.2em; }
          .tiptap p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            pointer-events: none;
            height: 0;
            color: ${textSub};
          }
        `}</style>
        <EditorContent editor={editor} className="tiptap" />
      </div>
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

export interface CreatePayload {
  title: string;
  content_type: ContentType;
  status: ContentStatus;
  platform: ContentPlatform;
  planned_date: string | null;
  script: string | null;
  reference_url: string | null;
  raw_video_url: string | null;
  edited_video_url: string | null;
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
  const [script, setScript]           = useState(item?.script ?? "");
  const [referenceUrl, setReferenceUrl]     = useState(item?.reference_url ?? "");
  const [rawVideoUrl, setRawVideoUrl]       = useState(item?.raw_video_url ?? "");
  const [editedVideoUrl, setEditedVideoUrl] = useState(item?.edited_video_url ?? "");
  const [titleError, setTitleError]         = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (scriptExpanded) { setScriptExpanded(false); return; }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, scriptExpanded]);

  async function handleSave() {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return; }
    setSaving(true);
    try {
      const payload: CreatePayload = {
        title:            title.trim(),
        content_type:     contentType,
        status,
        platform,
        planned_date:     plannedDate || null,
        script:           script.trim() || null,
        reference_url:    referenceUrl.trim() || null,
        raw_video_url:    rawVideoUrl.trim() || null,
        edited_video_url: editedVideoUrl.trim() || null,
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

  function openScriptExpanded() {
    setScriptExpanded(true);
  }

  // Theme tokens
  const modalBg           = isLight ? "#ffffff" : "rgba(14,14,16,0.97)";
  const borderColor       = isLight ? "rgba(17,17,17,0.10)" : "rgba(255,255,255,0.09)";
  const textMain          = isLight ? "#111111" : "rgba(255,255,255,0.88)";
  const textSub           = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";
  const labelColor        = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.35)";
  const inputBg           = isLight ? "rgba(17,17,17,0.04)" : "rgba(255,255,255,0.04)";
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

  const urlInputStyle: React.CSSProperties = { ...inputStyle, border: `1px solid ${inputBorderNormal}` };

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

          {/* Título */}
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

          {/* Tipo */}
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

          {/* Estado + Fecha */}
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
                style={{ ...inputStyle, border: `1px solid ${inputBorderNormal}`, colorScheme: isLight ? "light" : "dark" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
                onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
              />
            </div>
          </div>

          {/* Plataforma */}
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

          {/* Referencia */}
          <UrlField
            label="Referencia"
            value={referenceUrl}
            onChange={setReferenceUrl}
            placeholder="Link al video de referencia…"
            inputStyle={urlInputStyle}
            inputBorderNormal={inputBorderNormal}
            inputBorderFocus={inputBorderFocus}
            labelStyle={labelStyle}
          />

          {/* Guion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label style={{ ...labelStyle, marginBottom: 0 }}>Guion</label>
              <button
                type="button"
                onClick={openScriptExpanded}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                style={{
                  background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.90)",
                  color: isLight ? "white" : "#111111",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = "1"}
              >
                <Maximize2 size={12} />
                Expandir guion
              </button>
            </div>
            <textarea
              value={scriptToPlainText(script)}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Escribí el guion o caption completo…"
              rows={4}
              style={{ ...inputStyle, border: `1px solid ${inputBorderNormal}`, resize: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
            />
          </div>

          {/* Link video crudo */}
          <UrlField
            label="Video crudo"
            value={rawVideoUrl}
            onChange={setRawVideoUrl}
            placeholder="Link al video sin editar…"
            inputStyle={urlInputStyle}
            inputBorderNormal={inputBorderNormal}
            inputBorderFocus={inputBorderFocus}
            labelStyle={labelStyle}
          />

          {/* Link video editado */}
          <UrlField
            label="Video editado"
            value={editedVideoUrl}
            onChange={setEditedVideoUrl}
            placeholder="Link al video editado final…"
            inputStyle={urlInputStyle}
            inputBorderNormal={inputBorderNormal}
            inputBorderFocus={inputBorderFocus}
            labelStyle={labelStyle}
          />

          {/* Métricas (solo publicado) */}
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
                  const labels = { reach: "Alcance", likes: "Likes", saves: "Guardados", comments: "Comentarios", shares: "Compartidos" };
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

    {/* ── Guion expandido ── */}
    {scriptExpanded && (
      <div
        className="fixed inset-0 z-[60] flex"
        style={{ background: isLight ? "#f9f9fb" : "rgba(8,8,10,0.98)" }}
      >
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="flex items-center justify-between px-8 py-3 shrink-0"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <p className="text-[13px] font-semibold" style={{ color: textMain }}>Modo guion</p>
            <button
              onClick={() => setScriptExpanded(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all"
              style={{ background: inputBg, border: `1px solid ${borderColor}`, color: textSub }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
            >
              <X size={12} /> Cerrar
            </button>
          </div>
          <ScriptEditor
            content={script}
            onChange={setScript}
            isLight={isLight}
            textMain={textMain}
            textSub={textSub}
            border={borderColor}
            inputBg={inputBg}
          />
          <div
            className="px-12 py-3 shrink-0 flex gap-4"
            style={{ borderTop: `1px solid ${borderColor}` }}
          >
            <p className="text-[11px]" style={{ color: textSub }}>
              {countWords(script)} palabras
            </p>
            <p className="text-[11px]" style={{ color: textSub }}>
              ~{Math.ceil(countWords(script) / 130)} min lectura
            </p>
          </div>
        </div>

        {/* Sidebar con metadata */}
        <div
          className="w-72 shrink-0 flex flex-col gap-5 overflow-y-auto px-6 py-8"
          style={{ borderLeft: `1px solid ${borderColor}` }}
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: labelColor }}>Título</p>
            <p className="text-[14px] font-medium leading-snug" style={{ color: textMain }}>{title || "Sin título"}</p>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Estado</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: CONTENT_STATUSES.find(s => s.value === status)?.dot }} />
              <p className="text-[13px]" style={{ color: textMain }}>
                {CONTENT_STATUSES.find(s => s.value === status)?.label}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>Tipo · Plataforma</p>
            <p className="text-[13px]" style={{ color: textMain }}>
              {CONTENT_TYPES.find(t => t.value === contentType)?.label} · {CONTENT_PLATFORMS.find(p => p.value === platform)?.label}
            </p>
          </div>

          {plannedDate && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: labelColor }}>Fecha objetivo</p>
              <p className="text-[13px]" style={{ color: textMain }}>
                {new Date(plannedDate + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          )}

          {referenceUrl && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: labelColor }}>Referencia</p>
              <a
                href={referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] truncate block"
                style={{ color: "rgb(59,130,246)" }}
              >
                {referenceUrl}
              </a>
            </div>
          )}

          {rawVideoUrl && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: labelColor }}>Video crudo</p>
              <a
                href={rawVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] truncate block"
                style={{ color: "rgb(59,130,246)" }}
              >
                {rawVideoUrl}
              </a>
            </div>
          )}

          {editedVideoUrl && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: labelColor }}>Video editado</p>
              <a
                href={editedVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] truncate block"
                style={{ color: "rgb(59,130,246)" }}
              >
                {editedVideoUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
