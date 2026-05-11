"use client";

import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { Plus } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef  = useRef<HTMLDivElement>(null);

  const [dragOverStatus, setDragOverStatus] = useState<ContentStatus | null>(null);
  const [draggingId, setDraggingId]         = useState<string | null>(null);
  const [thumb, setThumb] = useState({ w: 100, l: 0 });

  const filtered = typeFilter === "all"
    ? items
    : items.filter((i) => i.content_type === typeFilter);

  function measure() {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    if (scrollWidth <= clientWidth) {
      setThumb(prev => (prev.w === 100 && prev.l === 0) ? prev : { w: 100, l: 0 });
      return;
    }
    const w = (clientWidth / scrollWidth) * 100;
    const l = (scrollLeft / (scrollWidth - clientWidth)) * (100 - w);
    setThumb(prev => (prev.w === w && prev.l === l) ? prev : { w, l });
  }

  // Measure after every render (layout already settled at this point)
  useLayoutEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Convert vertical wheel to horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 5) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  }

  function handleThumbMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    const trackW = track.getBoundingClientRect().width;
    const thumbPx = (el.clientWidth / el.scrollWidth) * trackW;
    const maxTravel = trackW - thumbPx;
    const scrollRange = el.scrollWidth - el.clientWidth;
    const onMove = (ev: MouseEvent) => {
      if (maxTravel <= 0) return;
      el.scrollLeft = startLeft + ((ev.clientX - startX) / maxTravel) * scrollRange;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const colBg      = isLight ? "rgba(17,17,17,0.03)"  : "rgba(255,255,255,0.03)";
  const colBorder  = isLight ? "rgba(17,17,17,0.07)"  : "rgba(255,255,255,0.06)";
  const headerBorder = isLight ? "rgba(17,17,17,0.06)" : "rgba(255,255,255,0.05)";
  const emptyText  = isLight ? "rgba(17,17,17,0.25)"  : "rgba(255,255,255,0.20)";
  const labelColor = isLight ? "rgba(17,17,17,0.55)"  : "rgba(255,255,255,0.55)";
  const countBg    = isLight ? "rgba(17,17,17,0.07)"  : "rgba(255,255,255,0.06)";
  const countText  = isLight ? "rgba(17,17,17,0.40)"  : "rgba(255,255,255,0.30)";
  const addColor   = isLight ? "rgba(17,17,17,0.30)"  : "rgba(255,255,255,0.28)";
  const addHoverBg = isLight ? "rgba(17,17,17,0.06)"  : "rgba(255,255,255,0.07)";
  const dragTargetBg     = isLight ? "rgba(17,17,17,0.06)"  : "rgba(255,255,255,0.07)";
  const dragTargetBorder = isLight ? "rgba(17,17,17,0.18)"  : "rgba(255,255,255,0.16)";
  const trackBg    = isLight ? "rgba(17,17,17,0.08)"  : "rgba(255,255,255,0.08)";
  const thumbBg    = isLight ? "rgba(17,17,17,0.28)"  : "rgba(255,255,255,0.28)";

  const hasOverflow = thumb.w < 99;

  return (
    <div className="h-full flex flex-col gap-2">

      {/* ── Scrollbar: fijo arriba, clickeable y arrastrable ── */}
      <div
        ref={trackRef}
        className="h-[7px] rounded-full relative shrink-0"
        style={{
          background: trackBg,
          cursor: hasOverflow ? "pointer" : "default",
        }}
        onClick={hasOverflow ? handleTrackClick : undefined}
      >
        <div
          className="absolute top-0 h-full rounded-full transition-[left] duration-75"
          style={{
            width: `${thumb.w}%`,
            left:  `${thumb.l}%`,
            background: thumbBg,
            cursor: hasOverflow ? "grab" : "default",
          }}
          onMouseDown={hasOverflow ? handleThumbMouseDown : undefined}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* ── Columnas scrolleables ── */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none"
        onScroll={measure}
      >
        {CONTENT_STATUSES.map((statusMeta) => {
          const colItems    = filtered.filter((i) => i.status === statusMeta.value);
          const isDragTarget = dragOverStatus === statusMeta.value;

          return (
            <div
              key={statusMeta.value}
              className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden transition-all duration-150"
              style={{
                width: 236,
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
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 shrink-0"
                style={{ borderBottom: `1px solid ${headerBorder}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusMeta.dot }} />
                  <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: labelColor }}>
                    {statusMeta.label}
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
                  title={`Agregar en ${statusMeta.label}`}
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
                    <span className="text-[11px]" style={{ color: emptyText }}>Soltar acá</span>
                  </div>
                )}
                {!isDragTarget && colItems.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <span className="text-[11px] text-center px-3" style={{ color: emptyText }}>
                      Sin contenido
                    </span>
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
                    style={{
                      opacity: draggingId === item.id ? 0.4 : 1,
                      cursor: "grab",
                      transition: "opacity 0.15s",
                    }}
                  >
                    <ContentCard item={item} onClick={() => onCardClick(item)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="shrink-0 w-1" />
      </div>

      {/* Type legend */}
      <div className="shrink-0 flex items-center gap-3">
        {CONTENT_TYPES.map((t) => (
          <span key={t.value} className="text-[11px]" style={{ color: emptyText }}>
            {t.label}: {filtered.filter((i) => i.content_type === t.value).length}
          </span>
        ))}
        <span className="text-[11px]" style={{ color: emptyText }}>
          · Total: {filtered.length}
        </span>
      </div>
    </div>
  );
}
