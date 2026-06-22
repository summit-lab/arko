"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
  onReorder: (id: string, newPosition: number, status: ContentStatus) => void;
}

function sortByPosition(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function ContentPipeline({
  items,
  typeFilter,
  onCardClick,
  onAddInColumn,
  onStatusChange,
  onReorder,
}: ContentPipelineProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const t = useTranslations("mesaDeTrabajo");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cross-column drop target
  const [dragOverStatus, setDragOverStatus] = useState<ContentStatus | null>(null);
  const [draggingId, setDraggingId]         = useState<string | null>(null);
  // Within-column reorder: show insert indicator before this card id (null = end of list)
  const [insertBeforeId, setInsertBeforeId] = useState<string | null | "END">(null);
  const [insertInStatus, setInsertInStatus] = useState<ContentStatus | null>(null);

  const filtered = typeFilter === "all"
    ? items
    : items.filter((i) => i.content_type === typeFilter);

  // Horizontal scroll via vertical wheel when not over a vertically-scrollable child
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 5) return;
      if (e.deltaY === 0) return;
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
  const insertLineColor  = "rgba(139,92,246,0.7)";

  const handleCardDragOver = useCallback((
    e: React.DragEvent,
    cardId: string,
    status: ContentStatus,
    cardEl: HTMLElement,
  ) => {
    e.preventDefault();
    e.stopPropagation(); // don't trigger column dragOver
    e.dataTransfer.dropEffect = "move";
    const rect = cardEl.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setInsertInStatus(status);
    setInsertBeforeId(e.clientY < midY ? cardId : "AFTER_" + cardId as string);
    setDragOverStatus(null);
  }, []);

  const handleCardsDrop = useCallback((
    e: React.DragEvent,
    status: ContentStatus,
    colItems: ContentItem[],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;

    const rawTarget = insertBeforeId;
    setInsertBeforeId(null);
    setInsertInStatus(null);
    setDragOverStatus(null);
    setDraggingId(null);

    // Parse target
    let insertBefore: string | null = null; // null = end
    if (rawTarget && rawTarget !== "END") {
      insertBefore = rawTarget.startsWith("AFTER_")
        ? null // will be placed at end of prefix — recalculate below
        : rawTarget;
    }

    // Build new order
    const withoutDragged = colItems.filter((i) => i.id !== draggedId);
    let insertIdx: number;
    if (rawTarget === null || rawTarget === "END") {
      insertIdx = withoutDragged.length;
    } else if (rawTarget.startsWith("AFTER_")) {
      const afterId = rawTarget.replace("AFTER_", "");
      const afterIdx = withoutDragged.findIndex((i) => i.id === afterId);
      insertIdx = afterIdx === -1 ? withoutDragged.length : afterIdx + 1;
    } else {
      const beforeIdx = withoutDragged.findIndex((i) => i.id === insertBefore);
      insertIdx = beforeIdx === -1 ? 0 : beforeIdx;
    }

    const newOrder = [
      ...withoutDragged.slice(0, insertIdx),
      { id: draggedId },
      ...withoutDragged.slice(insertIdx),
    ];

    // Find the dragged item's current status
    const draggedItem = items.find((i) => i.id === draggedId);
    if (!draggedItem) return;

    if (draggedItem.status !== status) {
      // Cross-column: change status, place at insertIdx
      onStatusChange(draggedId, status);
      onReorder(draggedId, insertIdx, status);
    } else {
      // Within-column: reorder
      const newPos = newOrder.findIndex((i) => i.id === draggedId);
      if (newPos !== (draggedItem.position ?? 0)) {
        onReorder(draggedId, newPos, status);
      }
    }
  }, [insertBeforeId, items, onStatusChange, onReorder]);

  return (
    <div className="h-full flex flex-col gap-1.5">
      <div className="flex-1 min-h-0 relative">
        <div
          ref={scrollRef}
          className="absolute inset-0 flex gap-2.5 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none"
        >
          {CONTENT_STATUSES.map((statusMeta) => {
            const colItems     = sortByPosition(filtered.filter((i) => i.status === statusMeta.value));
            const isDragTarget = dragOverStatus === statusMeta.value && insertInStatus !== statusMeta.value;

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
                  // Only activate column highlight if not already handling a card-level dragOver
                  if (insertInStatus !== statusMeta.value) {
                    setDragOverStatus(statusMeta.value);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverStatus(null);
                    setInsertBeforeId(null);
                    setInsertInStatus(null);
                  }
                }}
                onDrop={(e) => {
                  // Only handle if no card-level drop happened
                  if (insertInStatus === statusMeta.value) return;
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
                <div
                  className="flex flex-col p-2 overflow-y-auto flex-1 scrollbar-none"
                  style={{ minHeight: 0, gap: 0 }}
                  onDragOver={(e) => {
                    // Catch drops at the bottom of the list (empty space)
                    e.preventDefault();
                    e.stopPropagation();
                    setInsertInStatus(statusMeta.value);
                    setInsertBeforeId("END");
                    setDragOverStatus(null);
                  }}
                  onDrop={(e) => handleCardsDrop(e, statusMeta.value, colItems)}
                >
                  {!isDragTarget && colItems.length === 0 && (
                    <div className="flex-1 flex items-center justify-center py-8">
                      <span className="text-[11px]" style={{ color: emptyText }}>{t("empty.pipeline")}</span>
                    </div>
                  )}
                  {isDragTarget && colItems.length === 0 && (
                    <div
                      className="flex-1 flex items-center justify-center py-8 rounded-lg border-2 border-dashed"
                      style={{ borderColor: dragTargetBorder }}
                    >
                      <span className="text-[11px]" style={{ color: emptyText }}>{t("empty.dropHere")}</span>
                    </div>
                  )}

                  {colItems.map((item) => {
                    const isThisBeforeTarget =
                      insertInStatus === statusMeta.value && insertBeforeId === item.id;
                    const isThisAfterTarget =
                      insertInStatus === statusMeta.value && insertBeforeId === "AFTER_" + item.id;

                    return (
                      <div key={item.id} style={{ paddingBottom: 6 }}>
                        {/* Insert line — before this card */}
                        {isThisBeforeTarget && (
                          <div
                            className="h-0.5 rounded-full mx-1 mb-1.5"
                            style={{ background: insertLineColor, boxShadow: `0 0 6px ${insertLineColor}` }}
                          />
                        )}

                        <div
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(item.id);
                            e.dataTransfer.setData("text/plain", item.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverStatus(null);
                            setInsertBeforeId(null);
                            setInsertInStatus(null);
                          }}
                          onDragOver={(e) => handleCardDragOver(e, item.id, statusMeta.value, e.currentTarget as HTMLElement)}
                          style={{
                            opacity: draggingId === item.id ? 0.35 : 1,
                            cursor: "grab",
                            transition: "opacity 0.15s",
                          }}
                        >
                          <ContentCard item={item} onClick={() => onCardClick(item)} />
                        </div>

                        {/* Insert line — after this card (last card hover lower half) */}
                        {isThisAfterTarget && (
                          <div
                            className="h-0.5 rounded-full mx-1 mt-1.5"
                            style={{ background: insertLineColor, boxShadow: `0 0 6px ${insertLineColor}` }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Insert line at end of list */}
                  {insertInStatus === statusMeta.value && insertBeforeId === "END" && (
                    <div
                      className="h-0.5 rounded-full mx-1"
                      style={{ background: insertLineColor, boxShadow: `0 0 6px ${insertLineColor}` }}
                    />
                  )}
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
