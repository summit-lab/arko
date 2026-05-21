"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertCircle, Calendar, ChevronRight, Trash2, PanelLeftOpen, Maximize2, Minimize2, Sparkles, MessageSquare, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES, CONTENT_TYPES } from "@/types/content-plan";
import type { ContentItem, ContentStatus, ContentType } from "@/types/content-plan";
import { ScriptEditorV2 } from "./ScriptEditorV2";
import { useScriptLayout } from "./ScriptLayoutContext";
import { MokaContentPanel } from "./MokaContentPanel";
import { ScriptCommentsPanel } from "./ScriptCommentsPanel";
import type { ScriptChatContext } from "@/hooks/useArkoChat";

const AUTOSAVE_DEBOUNCE = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

interface ScriptPageProps {
  item: ContentItem;
  workspaceId: string;
}

// Strip HTML for word counting
function countWords(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function ScriptPage({ item, workspaceId }: ScriptPageProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const router = useRouter();
  const t = useTranslations("mesaDeTrabajo");
  const locale = useLocale();
  const { sidebarCollapsed, setSidebarCollapsed, focusMode, setFocusMode, setActiveSibling, refreshSiblings } = useScriptLayout();

  const [title, setTitle]         = useState(item.title);
  const [scriptHtml, setScriptHtml] = useState(item.script ?? "");
  const [status, setStatus]       = useState<ContentItem["status"]>(item.status);
  const [statusOpen, setStatusOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mokaOpen, setMokaOpen]         = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize del título: que crezca en alto según el texto, sin scroll horizontal.
  // useLayoutEffect para que el ajuste ocurra antes del paint (sin flicker).
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Re-ajustar cuando cambia el ancho del contenedor (sidebar, Moka panel, resize).
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title]);
  // Bumped whenever Moka rewrites our script so the editor remounts and
  // picks up the new content (Tiptap's `content` prop is initial-only).
  const [editorRevision, setEditorRevision] = useState(0);

  // When item.id changes (navigated to a different script), reset local state
  // and the lastSaved baseline so we don't auto-save the previous item's content
  // into the new one.
  useEffect(() => {
    setTitle(item.title);
    setScriptHtml(item.script ?? "");
    setStatus(item.status);
    setSaveState("idle");
    setConfirmDelete(false);
    setStatusOpen(false);
    lastSaved.current = { title: item.title, script: item.script ?? "" };
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Publish the active sibling so the sidebar can surface scriptless items
  // and reflect live title edits without a full refetch.
  useEffect(() => {
    setActiveSibling({
      id: item.id,
      title: title || item.title,
      status,
      content_type: item.content_type,
      planned_date: item.planned_date,
      script: scriptHtml || item.script || null,
      updated_at: item.updated_at,
    });
    return () => setActiveSibling(null);
    // setActiveSibling es estable (useState dispatcher); no va en deps para evitar loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.content_type, item.planned_date, item.updated_at, item.title, item.script, title, scriptHtml, status]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const saveTimer = useRef<number | null>(null);
  const lastSaved = useRef<{ title: string; script: string }>({ title: item.title, script: item.script ?? "" });

  const persist = useCallback(async (partial: { title?: string; script?: string; status?: ContentItem["status"] }) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/v1/content-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({ id: item.id, ...partial }),
      });
      if (!res.ok) throw new Error();
      if (partial.title  !== undefined) lastSaved.current.title  = partial.title;
      if (partial.script !== undefined) lastSaved.current.script = partial.script;
      setSaveState("saved");
    } catch {
      setSaveState("error");
      throw new Error("persist failed");
    }
  }, [item.id, workspaceId]);

  // Cerrar el dropdown de status al click afuera o ESC.
  const statusBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statusOpen) return;
    const onClick = (e: MouseEvent) => {
      if (statusBtnRef.current && !statusBtnRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStatusOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [statusOpen]);

  // Cambio de status — optimistic + rollback + refresh del sidebar.
  const handleStatusChange = useCallback(async (newStatus: ContentItem["status"]) => {
    if (newStatus === status) { setStatusOpen(false); return; }
    const prev = status;
    setStatus(newStatus);
    setStatusOpen(false);
    try {
      await persist({ status: newStatus });
      refreshSiblings();
    } catch {
      setStatus(prev);
    }
  }, [status, persist, refreshSiblings]);

  // Schedule auto-save
  useEffect(() => {
    const titleDirty  = title.trim() !== lastSaved.current.title.trim();
    const scriptDirty = scriptHtml   !== lastSaved.current.script;
    if (!titleDirty && !scriptDirty) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const partial: { title?: string; script?: string } = {};
      if (titleDirty  && title.trim().length > 0) partial.title  = title.trim();
      if (scriptDirty) partial.script = scriptHtml;
      if (Object.keys(partial).length > 0) void persist(partial);
    }, AUTOSAVE_DEBOUNCE);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [title, scriptHtml, persist]);

  // Cmd/Ctrl+S → flush immediately
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        const partial: { title?: string; script?: string } = {};
        if (title.trim() !== lastSaved.current.title.trim() && title.trim().length > 0) partial.title = title.trim();
        if (scriptHtml !== lastSaved.current.script) partial.script = scriptHtml;
        if (Object.keys(partial).length > 0) void persist(partial);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [title, scriptHtml, persist]);

  // Fade "saved" badge after 2s
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = window.setTimeout(() => setSaveState("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [saveState]);

  // Close Moka and comments when entering focus mode (foco = no distractions)
  useEffect(() => {
    if (focusMode && mokaOpen) setMokaOpen(false);
    if (focusMode && commentsOpen) setCommentsOpen(false);
  }, [focusMode, mokaOpen, commentsOpen]);

  // Build the context Moka receives on every message while editing this script
  const mokaContext = useMemo<ScriptChatContext>(() => ({
    type: "script",
    script_id: item.id,
    title: title || null,
    content_type: item.content_type,
    status,
    planned_date: item.planned_date,
    script: scriptHtml || null,
  }), [item.id, item.content_type, status, item.planned_date, title, scriptHtml]);

  // When Moka updates an item from within the editor:
  //  - if it's the active item, sync our local state and bump editor revision
  //  - if it's another item, refresh the siblings list so the sidebar reflects it
  const handleMokaContentUpdated = useCallback((updated: Record<string, unknown>) => {
    const id = updated.id as string | undefined;
    if (!id) return;
    if (id === item.id) {
      const newScript = (updated.script as string | null | undefined) ?? "";
      const newTitle  = (updated.title  as string | null | undefined) ?? title;
      const newStatus = updated.status as ContentItem["status"] | undefined;
      // Update our refs so the auto-save loop doesn't try to overwrite Moka's
      // change with our stale state.
      lastSaved.current = { title: newTitle, script: newScript };
      setScriptHtml(newScript);
      setTitle(newTitle);
      if (newStatus) setStatus(newStatus);
      setEditorRevision((r) => r + 1);
    } else {
      void refreshSiblings();
    }
  }, [item.id, title, refreshSiblings]);

  const handleMokaContentAdded = useCallback((items: Record<string, unknown>[]) => {
    if (items.length > 0) void refreshSiblings();
  }, [refreshSiblings]);

  const handleMokaContentDeleted = useCallback((id: string) => {
    if (id === item.id) {
      window.dispatchEvent(new Event("nav:start"));
      router.push("/mesa-de-trabajo");
      return;
    }
    void refreshSiblings();
  }, [item.id, refreshSiblings, router]);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/content-plan?id=${item.id}&workspace_id=${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      void refreshSiblings();
      window.dispatchEvent(new Event("nav:start"));
      router.push("/mesa-de-trabajo");
    } finally {
      setDeleting(false);
    }
  }

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const border    = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const textMain  = isLight ? "#111111" : "rgba(255,255,255,0.92)";
  const textSub   = isLight ? "rgba(17,17,17,0.50)" : "rgba(255,255,255,0.42)";
  const labelCol  = isLight ? "rgba(17,17,17,0.40)" : "rgba(255,255,255,0.32)";
  const popoverBg = isLight ? "#ffffff" : "rgba(28,28,32,0.98)";
  const hoverBg   = isLight ? "rgba(17,17,17,0.05)" : "rgba(255,255,255,0.06)";

  const statusMeta = CONTENT_STATUSES.find((s) => s.value === status);
  const typeMeta   = CONTENT_TYPES.find((t) => t.value === item.content_type);

  const saveLabel = useMemo(() => {
    if (saveState === "saving")  return { text: t("scripts.saving"),     icon: <Loader2 size={12} className="animate-spin" />, color: textSub };
    if (saveState === "saved")   return { text: t("scripts.saved"),      icon: <Check size={12} />,                            color: "rgb(34,197,94)" };
    if (saveState === "error")   return { text: t("scripts.saveError"),  icon: <AlertCircle size={12} />,                      color: "rgb(239,68,68)" };
    return null;
  }, [saveState, textSub, t]);

  const editorMaxW = focusMode ? 920 : 720;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: focusMode ? "none" : `1px solid ${border}` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {!focusMode && (
            <>
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  title={t("scripts.expandSidebar")}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-colors -ml-1 mr-1"
                  style={{ color: textSub }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
                >
                  <PanelLeftOpen size={14} strokeWidth={1.75} />
                </button>
              )}
              <Link
                href="/mesa-de-trabajo"
                className="text-[12.5px] transition-colors"
                style={{ color: textSub }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
              >
                {t("title")}
              </Link>
              <ChevronRight size={12} style={{ color: labelCol }} />
              <p className="text-[12.5px] truncate" style={{ color: textMain, maxWidth: 360 }}>
                {title || t("scripts.untitled")}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveLabel && (
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: saveLabel.color }}>
              {saveLabel.icon}
              <span>{saveLabel.text}</span>
            </div>
          )}
          {!focusMode && (
            <button
              onClick={() => {
                setCommentsOpen(true);
                setFocusInputTrigger((n) => n + 1);
              }}
              title="Agregar comentario"
              className="flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              style={{ background: "rgba(139,92,246,0.12)", color: "rgb(167,139,250)", border: "1px solid rgba(139,92,246,0.2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.12)"; }}
            >
              <Plus size={11} strokeWidth={2.5} />
              Comentario
            </button>
          )}
          {!focusMode && (
            <button
              onClick={() => setCommentsOpen((v) => !v)}
              title="Comentarios"
              className="relative flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md transition-colors cursor-pointer"
              style={{ color: commentsOpen ? textMain : textSub }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = commentsOpen ? textMain : textSub}
            >
              <MessageSquare size={12} />
              Comentarios
              {commentCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold tabular-nums"
                  style={{ background: "rgba(139,92,246,0.9)", color: "#fff" }}>
                  {commentCount > 9 ? "9+" : commentCount}
                </span>
              )}
            </button>
          )}
          {!focusMode && (
            <button
              onClick={() => setMokaOpen((v) => !v)}
              title={mokaOpen ? t("scripts.closeMoka") : t("scripts.openMoka")}
              className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md transition-colors cursor-pointer"
              style={{ color: mokaOpen ? textMain : textSub }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = mokaOpen ? textMain : textSub}
            >
              <Sparkles size={12} />
              {mokaOpen ? t("scripts.closeMoka") : t("scripts.moka")}
            </button>
          )}
          <button
            onClick={() => setFocusMode((v) => !v)}
            title={focusMode ? t("scripts.exitFocusTitle") : t("scripts.focusModeTitle")}
            className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md transition-colors cursor-pointer"
            style={{ color: textSub }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = textMain}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = textSub}
          >
            {focusMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {focusMode ? t("scripts.exitFocus") : t("scripts.focusMode")}
          </button>
          {!focusMode && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ color: confirmDelete ? "rgb(239,68,68)" : textSub }}
              onMouseEnter={(e) => { if (!confirmDelete) (e.currentTarget as HTMLElement).style.color = textMain; }}
              onMouseLeave={(e) => { if (!confirmDelete) (e.currentTarget as HTMLElement).style.color = textSub; }}
            >
              <Trash2 size={12} />
              {confirmDelete ? t("scripts.confirmDelete") : t("scripts.delete")}
            </button>
          )}
        </div>
      </div>

      {/* Title + metadata + editor */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div
          className="mx-auto px-8"
          style={{ maxWidth: editorMaxW, paddingTop: focusMode ? 80 : 64 }}
        >
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Enter no debe meter saltos de línea en el título.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={t("scripts.untitled")}
            rows={1}
            className="w-full outline-none bg-transparent resize-none overflow-hidden block"
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              padding: 0,
              margin: 0,
              border: 0,
              color: textMain,
              wordBreak: "break-word",
              boxSizing: "content-box",
              fontFamily: "inherit",
            }}
          />

          {!focusMode && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {statusMeta && (
                <div ref={statusBtnRef} className="relative">
                  <button
                    onClick={() => setStatusOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-md transition-colors cursor-pointer"
                    style={{ background: statusOpen ? hoverBg : "transparent" }}
                    onMouseEnter={(e) => { if (!statusOpen) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                    onMouseLeave={(e) => { if (!statusOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                    <span className="text-[12px]" style={{ color: textSub }}>{t(`status.${statusMeta.value}` as `status.${ContentStatus}`)}</span>
                  </button>
                  {statusOpen && (
                    <div
                      className="absolute z-50 mt-1 rounded-lg overflow-hidden shadow-lg"
                      style={{
                        top: "100%",
                        left: 0,
                        minWidth: 200,
                        background: popoverBg,
                        border: `1px solid ${border}`,
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      {CONTENT_STATUSES.map((s) => {
                        const isCurrent = s.value === status;
                        return (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(s.value)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                            style={{
                              background: isCurrent ? hoverBg : "transparent",
                              color: textMain,
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                            onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                            <span className="text-[12.5px]">{t(`status.${s.value}` as `status.${ContentStatus}`)}</span>
                            {isCurrent && (
                              <Check size={12} style={{ color: textSub, marginLeft: "auto" }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {typeMeta && (
                <>
                  <span style={{ color: labelCol }}>·</span>
                  <span className="text-[12px]" style={{ color: textSub }}>{t(`type.${typeMeta.value}` as `type.${ContentType}`)}</span>
                </>
              )}
              {item.planned_date && (
                <>
                  <span style={{ color: labelCol }}>·</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} style={{ color: textSub }} />
                    <span className="text-[12px]" style={{ color: textSub }}>
                      {new Date(item.planned_date + "T12:00:00").toLocaleDateString(locale === "en" ? "en-US" : "es-AR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                </>
              )}
              <span style={{ color: labelCol }}>·</span>
              <span className="text-[12px] tabular-nums" style={{ color: textSub }}>
                {t("scripts.wordsCount", { count: countWords(scriptHtml) })} · {t("scripts.readTime", { minutes: Math.max(1, Math.ceil(countWords(scriptHtml) / 130)) })}
              </span>
            </div>
          )}

          <div className="h-8" />
        </div>

        <ScriptEditorV2
          key={`${item.id}:${editorRevision}`}
          initialHtml={scriptHtml}
          onChange={setScriptHtml}
          isLight={isLight}
          maxWidth={editorMaxW}
        />
      </div>

      {/* Comments panel — slide-in desde la derecha */}
      <ScriptCommentsPanel
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        scriptId={item.id}
        workspaceId={workspaceId}
        onCountChange={setCommentCount}
        focusInputTrigger={focusInputTrigger}
      />

      {/* Moka — slide-in modal with backdrop blur (managed by MokaContentPanel) */}
      <MokaContentPanel
        open={!focusMode && mokaOpen}
        workspaceId={workspaceId}
        context={mokaContext}
        greeting={title ? t("scripts.mokaGreeting", { title }) : t("scripts.mokaGreetingNoTitle")}
        suggestions={[
          "Reescribime el guion en tono más conversacional",
          "Mejorá el hook de las primeras dos líneas",
          "Sumá un CTA al final del guion",
          "Acortá el guion a 60 segundos de lectura",
        ]}
        onClose={() => setMokaOpen(false)}
        onContentAdded={handleMokaContentAdded}
        onContentUpdated={handleMokaContentUpdated}
        onContentDeleted={handleMokaContentDeleted}
      />
    </div>
  );
}
