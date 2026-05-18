"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, Trash2, ChevronDown, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES, CONTENT_TYPES } from "@/types/content-plan";
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
  /** Mapa de value → label traducido. */
  labelFor: (value: ContentStatus) => string;
  value: ContentStatus;
  onChange: (v: ContentStatus) => void;
  isLight: boolean;
  textMain: string;
  textSub: string;
  border: string;
  inputBg: string;
}

function StatusSelect({
  options, labelFor, value, onChange, isLight, textMain, textSub, border, inputBg,
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
        <span className="flex-1">{labelFor(currentMeta.value)}</span>
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
                {labelFor(opt.value)}
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

// (ScriptEditor was extracted to its own page at /mesa-de-trabajo/[id]/guion)

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
  const t = useTranslations("mesaDeTrabajo");

  const typeOptionsLocalized = CONTENT_TYPES.map((o) => ({
    value: o.value,
    label: t(`type.${o.value}` as `type.${ContentType}`),
  }));
  const statusLabelFor = (v: ContentStatus) => t(`status.${v}` as `status.${ContentStatus}`);

  const [title, setTitle]             = useState(item?.title ?? "");
  const [contentType, setContentType] = useState<ContentType>(item?.content_type ?? "reel");
  const [status, setStatus]           = useState<ContentStatus>(item?.status ?? defaultStatus);
  const [platform]                    = useState<ContentPlatform>(item?.platform ?? "instagram");
  const [plannedDate, setPlannedDate] = useState(item?.planned_date ?? "");
  const [script, setScript]           = useState(item?.script ?? "");
  const [referenceUrl, setReferenceUrl]     = useState(item?.reference_url ?? "");
  const [rawVideoUrl, setRawVideoUrl]       = useState(item?.raw_video_url ?? "");
  const [editedVideoUrl, setEditedVideoUrl] = useState(item?.edited_video_url ?? "");
  const [titleError, setTitleError]         = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) { setTitleError(true); titleRef.current?.focus(); return; }
    setSaving(true);
    setSaveError(null);
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
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
            {isEdit ? t("modal.titleEdit") : t("modal.titleCreate")}
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
            <label style={labelStyle}>{t("modal.fieldTitle")}</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              placeholder={t("modal.fieldTitlePlaceholder")}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = titleError ? "rgba(239,68,68,0.5)" : inputBorderNormal)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            {titleError && (
              <p className="text-[11px] text-red-500 mt-1">{t("modal.errorTitle")}</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>{t("modal.fieldType")}</label>
            <PillGroup
              options={typeOptionsLocalized}
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
              <label style={labelStyle}>{t("modal.fieldStatus")}</label>
              <StatusSelect
                options={CONTENT_STATUSES}
                labelFor={statusLabelFor}
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
              <label style={labelStyle}>{t("modal.fieldDate")}</label>
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

          {/* Referencia */}
          <UrlField
            label={t("modal.fieldReference")}
            value={referenceUrl}
            onChange={setReferenceUrl}
            placeholder={t("modal.fieldReferencePlaceholder")}
            inputStyle={urlInputStyle}
            inputBorderNormal={inputBorderNormal}
            inputBorderFocus={inputBorderFocus}
            labelStyle={labelStyle}
          />

          {/* Guion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label style={{ ...labelStyle, marginBottom: 0 }}>{t("modal.fieldScript")}</label>
              {isEdit && (
                <Link
                  href={`/mesa-de-trabajo/${item.id}/guion`}
                  onClick={() => window.dispatchEvent(new Event("nav:start"))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: isLight ? "rgba(17,17,17,0.88)" : "rgba(255,255,255,0.90)",
                    color: isLight ? "white" : "#111111",
                  }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = "1"}
                >
                  <FileText size={12} />
                  {t("modal.openEditor")}
                </Link>
              )}
            </div>
            <textarea
              value={scriptToPlainText(script)}
              onChange={(e) => setScript(e.target.value)}
              placeholder={isEdit ? t("modal.scriptPreviewPlaceholder") : t("modal.fieldScriptPlaceholder")}
              rows={4}
              style={{ ...inputStyle, border: `1px solid ${inputBorderNormal}`, resize: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = inputBorderFocus)}
              onBlur={(e) => (e.currentTarget.style.borderColor = inputBorderNormal)}
            />
          </div>

          {/* Link video crudo */}
          <UrlField
            label={t("modal.fieldRawVideo")}
            value={rawVideoUrl}
            onChange={setRawVideoUrl}
            placeholder={t("modal.fieldRawVideoPlaceholder")}
            inputStyle={urlInputStyle}
            inputBorderNormal={inputBorderNormal}
            inputBorderFocus={inputBorderFocus}
            labelStyle={labelStyle}
          />

          {/* Link video editado */}
          <UrlField
            label={t("modal.fieldEditedVideo")}
            value={editedVideoUrl}
            onChange={setEditedVideoUrl}
            placeholder={t("modal.fieldEditedVideoPlaceholder")}
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
              <p style={labelStyle}>{t("metrics.title")}</p>
              <div className="grid grid-cols-3 gap-3">
                {(["reach", "likes", "saves", "comments", "shares"] as const).map((k) => {
                  const v = item.metrics?.[k];
                  if (!v) return null;
                  return (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: textSub }}>{t(`metrics.${k}` as `metrics.${typeof k}`)}</p>
                      <p className="text-[15px] font-light" style={{ color: textMain }}>{v.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 pb-5 pt-3 flex flex-col gap-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          {saveError && (
            <p className="text-[12px] text-red-500 text-center px-2">{saveError}</p>
          )}
        <div className="flex items-center justify-between gap-3">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[13px] transition-colors"
              style={{ color: confirmDelete ? "rgb(239,68,68)" : textSub }}
            >
              <Trash2 size={13} />
              {deleting ? t("modal.deleting") : confirmDelete ? t("modal.deleteConfirmShort") : t("modal.delete")}
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
              {t("modal.cancel")}
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
              {saving ? t("modal.saving") : t("modal.save")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>

    </>
  );
}
