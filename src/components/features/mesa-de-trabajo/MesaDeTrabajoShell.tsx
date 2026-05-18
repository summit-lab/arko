"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Kanban, CalendarDays, Sparkles, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_TYPES } from "@/types/content-plan";
import type {
  ContentItem,
  ContentStatus,
  ContentType,
  CalendarReel,
} from "@/types/content-plan";
import { ContentPipeline } from "./ContentPipeline";
import { ContentCalendar } from "./ContentCalendar";
import { ContentItemModal } from "./ContentItemModal";
import type { CreatePayload } from "./ContentItemModal";
import { MokaContentPanel } from "./MokaContentPanel";

type ViewMode = "pipeline" | "calendar";

const HEADER_H = 80;

interface MesaDeTrabajoShellProps {
  initialItems: ContentItem[];
  publishedReels: CalendarReel[];
  workspaceId: string;
}

export function MesaDeTrabajoShell({
  initialItems,
  publishedReels,
  workspaceId,
}: MesaDeTrabajoShellProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo");
  const router = useRouter();

  // Most-recently-edited item that has a non-empty script. Falls back to the
  // first item in the list when nothing has been scripted yet. We compute this
  // each render based on `items` so the destination is always fresh.
  const scriptsDestination = useMemo(() => {
    const withScript = initialItems
      .filter((it) => typeof it.script === "string" && it.script.trim().length > 0)
      .sort((a, b) => (b.updated_at < a.updated_at ? -1 : b.updated_at > a.updated_at ? 1 : 0));
    return withScript[0]?.id ?? initialItems[0]?.id ?? null;
  }, [initialItems]);

  const openScripts = useCallback(() => {
    if (!scriptsDestination) return;
    window.dispatchEvent(new Event("nav:start"));
    router.push(`/mesa-de-trabajo/${scriptsDestination}/guion`);
  }, [router, scriptsDestination]);

  const [items, setItems]             = useState<ContentItem[]>(initialItems);
  const [view, setView]               = useState<ViewMode>("pipeline");
  const [typeFilter, setTypeFilter]   = useState<ContentType | "all">("all");
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [modalStatus, setModalStatus] = useState<ContentStatus>("idea");
  const [modalDate, setModalDate]     = useState<string | null>(null);
  const [mokaOpen, setMokaOpen]       = useState(false);

  // Disable the main scroll container so the layout is fully self-contained.
  // Without this, the parent <main overflow-y-auto> scrolls and hides the Moka panel.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prev = main.style.overflow;
    main.style.overflow = "hidden";
    return () => { main.style.overflow = prev; };
  }, []);

  const border  = isLight ? "rgba(17,17,17,0.08)" : "rgba(255,255,255,0.07)";
  const textSub = isLight ? "rgba(17,17,17,0.45)" : "rgba(255,255,255,0.38)";

  function openCreate(status: ContentStatus = "idea", date?: string) {
    setEditingItem(null);
    setModalStatus(status);
    setModalDate(date ?? null);
    setModalOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setModalDate(null);
  }

  const handleCreate = useCallback(async (data: CreatePayload) => {
    const payload = { ...data, planned_date: modalDate ?? data.planned_date };
    const res = await fetch("/api/v1/content-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? "Error creando item");
    }
    const json = await res.json() as { data: { item: ContentItem } };
    setItems((prev) => [json.data.item, ...prev]);
  }, [modalDate, workspaceId]);

  const handleUpdate = useCallback(async (id: string, data: Partial<CreatePayload>) => {
    const res = await fetch("/api/v1/content-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) throw new Error("Error actualizando item");
    const json = await res.json() as { data: { item: ContentItem } };
    setItems((prev) => prev.map((i) => (i.id === id ? json.data.item : i)));
  }, [workspaceId]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/content-plan?id=${id}&workspace_id=${workspaceId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error eliminando item");
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [workspaceId]);

  // Drag-and-drop status change — optimistic + rollback
  const handleStatusChange = useCallback(async (id: string, newStatus: ContentStatus) => {
    const prevItem = items.find((i) => i.id === id);
    if (!prevItem || prevItem.status === newStatus) return;

    setItems((all) => all.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));

    try {
      const res = await fetch("/api/v1/content-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { data: { item: ContentItem } };
      setItems((all) => all.map((i) => (i.id === id ? json.data.item : i)));
    } catch {
      setItems((all) => all.map((i) => (i.id === id ? prevItem : i)));
    }
  }, [items, workspaceId]);

  const typeOptions: { value: ContentType | "all"; label: string }[] = [
    { value: "all",       label: t("filters.all") },
    ...CONTENT_TYPES.map((ct) => ({
      value: ct.value,
      label: t(`filters.${ct.value}` as Parameters<typeof t>[0]),
    })),
  ];

  const btnBase     = "px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer";
  const btnActive   = isLight
    ? `${btnBase} bg-[rgba(17,17,17,0.08)] text-[#111111]`
    : `${btnBase} bg-white/[0.10] text-white/90`;
  const btnInactive = isLight
    ? `${btnBase} text-[rgba(17,17,17,0.45)] hover:text-[rgba(17,17,17,0.7)] hover:bg-[rgba(17,17,17,0.04)]`
    : `${btnBase} text-white/35 hover:text-white/60 hover:bg-white/[0.04]`;

  return (
    <>
      {/* ── Content area — explicit height so children can use h-full ── */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(100vh - ${HEADER_H}px)` }}
      >
        {/* Header — does not scroll */}
        <div className="flex items-center justify-between px-6 pt-7 pb-4 shrink-0">
          <div>
            <h1 className="page-title">{t("title")}</h1>
            <p className="text-[13px] font-light mt-0.5" style={{ color: textSub }}>
              {t("subtitle")}
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all shrink-0"
            style={{
              background: isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.07)",
              border: `1px solid ${border}`,
              color: isLight ? "#111111" : "rgba(255,255,255,0.80)",
            }}
          >
            <Plus size={14} strokeWidth={2} />
            {t("newItem")}
          </button>
        </div>

        {/* Controls — does not scroll */}
        <div className="flex items-center justify-between px-6 pb-3 shrink-0 flex-wrap gap-2">
          {/* View toggle */}
          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5"
            style={{
              background: isLight ? "rgba(17,17,17,0.05)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${border}`,
            }}
          >
            {([
              { value: "pipeline"  as ViewMode, labelKey: "views.pipeline",  Icon: Kanban },
              { value: "calendar"  as ViewMode, labelKey: "views.calendar",  Icon: CalendarDays },
            ] as const).map(({ value, labelKey, Icon }) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
                  view === value
                    ? isLight ? "bg-white text-[#111111] shadow-sm" : "bg-white/[0.10] text-white/90"
                    : isLight ? "text-[rgba(17,17,17,0.45)] hover:text-[rgba(17,17,17,0.7)]" : "text-white/35 hover:text-white/60"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {t(labelKey as Parameters<typeof t>[0])}
              </button>
            ))}
            <button
              onClick={openScripts}
              disabled={!scriptsDestination}
              title={scriptsDestination ? undefined : "Aún no hay contenido"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isLight
                  ? "text-[rgba(17,17,17,0.45)] hover:text-[rgba(17,17,17,0.7)]"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              <FileText size={13} strokeWidth={1.5} />
              {t("views.scripts")}
            </button>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1">
            {typeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={typeFilter === value ? btnActive : btnInactive}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main view — fills remaining height and scrolls internally */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
          {view === "pipeline" ? (
            <ContentPipeline
              items={items}
              typeFilter={typeFilter}
              onCardClick={openEdit}
              onAddInColumn={(status) => openCreate(status)}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="h-full overflow-y-auto scrollbar-none pr-2">
              <ContentCalendar
                items={items}
                publishedReels={publishedReels}
                typeFilter={typeFilter}
                onCardClick={openEdit}
                onAddOnDate={(date) => openCreate("idea", date)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Floating "Preguntar a Moka" button — visible when Moka is closed ── */}
      {!mokaOpen && (
        <button
          onClick={() => setMokaOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium shadow-lg transition-all"
          style={{
            background: isLight ? "rgba(17,17,17,0.90)" : "rgba(255,255,255,0.12)",
            border: `1px solid ${isLight ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.15)"}`,
            color: isLight ? "white" : "rgba(255,255,255,0.88)",
            backdropFilter: "blur(12px)",
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          <Sparkles size={14} />
          Preguntar a Moka
        </button>
      )}

      {/* ── Moka AI — slide-in modal with backdrop blur (managed internally) ── */}
      <MokaContentPanel
        open={mokaOpen}
        workspaceId={workspaceId}
        items={items}
        onClose={() => setMokaOpen(false)}
        onContentAdded={(newItems) =>
          setItems((prev) => [...(newItems as unknown as ContentItem[]), ...prev])
        }
        onContentUpdated={(updated) =>
          setItems((prev) =>
            prev.map((i) => (i.id === (updated as unknown as ContentItem).id ? (updated as unknown as ContentItem) : i))
          )
        }
        onContentDeleted={(id) =>
          setItems((prev) => prev.filter((i) => i.id !== id))
        }
      />

      {/* Modal */}
      {modalOpen && (
        <ContentItemModal
          item={editingItem}
          defaultStatus={modalStatus}
          onClose={closeModal}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
