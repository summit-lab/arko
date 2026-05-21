"use client";

import { useRef, useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CONTENT_STATUSES, CONTENT_TYPES } from "@/types/content-plan";
import type { ContentItem, ContentStatus, ContentType } from "@/types/content-plan";
import { ContentCard } from "./ContentCard";

interface ContentPipelineProps {
  items: ContentItem[];
  typeFilter: ContentType | "all";
  onCardClick: (item: ContentItem) => void;
  onAddInColumn: (status: ContentStatus) => void;
  onStatusChange: (id: string, newStatus: ContentStatus) => void;
}

export function ContentPipeline({
  items,
  typeFilter,
  onCardClick,
  onAddInColumn,
  onStatusChange,
}: ContentPipelineProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [dragOverStatus, setDragOverStatus] = useState<ContentStatus | null>(null);
  const [draggingId, setDraggingId]         = useState<string | null>(null);

  const filtered = typeFilter === "all"
    ? items
    : items.filter((i) => i.content_type === typeFilter);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 5) return;
      if (e.deltaY === 0) return;
      // Si el target está dentro de un contenedor con scroll vertical, dejarlo scrollear.
      let node = e.target as HTMLElement | null;
      while (node && node !== el) {
        const style = getComputedStyle(node);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight
        ) return;
        node = node.parentElement;
      }
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const colBg            = isLight ? "rgba(17,17,17,0.03)"  : "rgba(255,255,255,0.03)";
  const colBorder        = isLight ? "rgba(17,17,17,0.07)"  : "rgba(255,255,255,0.06)";
  const headerBorder     = isLight ? "rgba(17,17,17,0.06)"  : "rgba(255,255,255,0.05)";
  const emptyText        = isLight ? "rgba(17,17,17,0.25)"  : "rgba(255,255,255,0.20)";
  const labelColor       = isLight ? "rgba(17,17,17,0.55)"  : "rgba(255,255,255,0.55)";
  const countBg          = isLight ? "rgba(17,17,17,0.07)"  : "rgba(255,255,255,0.06)";
  const countText        = isLight ? "rgba(17,17,17,0.40)"  : "rgba(255,255,255,0.30)";
  const addColor         = isLight ? "rgba(17,17,17,0.30)"  : "rgba(255,255,255,0.28)";
  const addHoverBg       = isLight ? "rgba(17,17,17,0.06)"  : "rgba(255,255,255,0.07)";
  const dragTargetBg     = isLight ? "rgba(17,17,17,0.06)"  : "rgba(255,255,255,0.07)";
  const dragTargetBorder = isLight ? "rgba(17,17,17,0.18)"  : "rgba(255,255,255,0.16)";

  return (
    <div className="h-full flex flex-col gap-1.5">

      {/* ── Columnas scrolleables ── */}
      {/* El wrapper ocupa el espacio flex-1; el inner es absolute para que tenga
          width explícito (inset-0), evitando que el flex container crezca con el
          contenido y haga scrollWidth == clientWidth (que rompía scrollBy). */}
      <div className="flex-1 min-h-0 relative">
      <div
        ref={scrollRef}
        className="absolute inset-0 flex gap-2.5 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none"
      >
        {CONTENT_STATUSES.map((statusMeta) => {
          const colItems     = filtered.filter((i) => i.status === statusMeta.value);
          const isDragTarget = dragOverStatus === statusMeta.value;

          return (
            <div
              key={statusMeta.value}
              className="flex-1 flex flex-col rounded-xl overflow-hidden transition-all duration-150"
              style={{
                minWidth: 220,
                background: isDragTarget ? dragTargetBg : colBg,
                border: `1px solid ${isDragTarget ? dragTargetBorder : colBorder}`,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(statusMeta.value);
              }}
              onDragLeave={(e) => {
                if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onStatusChange(id, statusMeta.value);
                setDragOverStatus(null);
                setDraggingId(null);
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 shrink-0"
                style={{ borderBottom: `1px solid ${headerBorder}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusMeta.dot }} />
                  <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: labelColor }}>
                    {t(`status.${statusMeta.value}` as `status.${ContentStatus}`)}
                  </span>
                  {colItems.length > 0 && (
                    <span
                      className="text-[10px] rounded-full px-1.5 py-px leading-none font-medium"
                      style={{ background: countBg, color: countText }}
                    >
                      {colItems.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAddInColumn(statusMeta.value)}
                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                  style={{ color: addColor }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = addHoverBg;
                    (e.currentTarget as HTMLElement).style.color = labelColor;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = addColor;
                  }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 p-2 overflow-y-auto flex-1 scrollbar-none" style={{ minHeight: 0 }}>
                {isDragTarget && colItems.length === 0 && (
                  <div
                    className="flex-1 flex items-center justify-center py-8 rounded-lg border-2 border-dashed"
                    style={{ borderColor: dragTargetBorder }}
                  >
                    <span className="text-[11px]" style={{ color: emptyText }}>{t("empty.dropHere")}</span>
                  </div>
                )}
                {!isDragTarget && colItems.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <span className="text-[11px]" style={{ color: emptyText }}>{t("empty.pipeline")}</span>
                  </div>
                )}
                {colItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(item.id);
                      e.dataTransfer.setData("text/plain", item.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                    style={{ opacity: draggingId === item.id ? 0.4 : 1, cursor: "grab", transition: "opacity 0.15s" }}
                  >
                    <ContentCard item={item} onClick={() => onCardClick(item)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Leyenda */}
      <div className="shrink-0 flex items-center gap-3">
        {CONTENT_TYPES.map((typeMeta) => (
          <span key={typeMeta.value} className="text-[11px]" style={{ color: emptyText }}>
            {t(`type.${typeMeta.value}` as `type.${ContentType}`)}: {filtered.filter((i) => i.content_type === typeMeta.value).length}
          </span>
        ))}
        <span className="text-[11px]" style={{ color: emptyText }}>· Total: {filtered.length}</span>
      </div>
    </div>
  );
}
