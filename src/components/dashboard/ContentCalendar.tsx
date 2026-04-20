"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, Bookmark, MessageCircle, Play, ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarItemType = "reel" | "post" | "historia";

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  published_at: string;
  caption: string | null;
  has_ads: boolean;
  reel_type?: string;
  views_total: number;
  likes: number;
  saves: number;
  comments: number;
}

interface ContentCalendarProps {
  items: CalendarItem[];
}

const DAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

type ContentFilter = "all" | "reels" | "posts" | "historias";

function itemHref(item: CalendarItem): string {
  if (item.type === "historia") {
    // Stories viewer lives inside the Instagram dashboard with a tab/section.
    // If there's no dedicated route, fall back to the IG dashboard root.
    return `/instagram?story=${item.id}`;
  }
  // Reels + posts both use the unified detail route.
  return `/instagram/${item.id}`;
}

export function ContentCalendar({ items }: ContentCalendarProps) {
  const router = useRouter();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = now.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const isCurrentMonth = viewYear === currentYear && viewMonth === currentMonth;

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    setSelectedDay(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Filter by content type using item.type (set by the server based on media_type).
  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "reels") return item.type === "reel";
    if (filter === "posts") return item.type === "post";
    if (filter === "historias") return item.type === "historia";
    return true;
  });

  // Map days → items. Local-timezone getters (see long comment below).
  // NOTE: we deliberately use LOCAL Date methods (getFullYear/getMonth/getDate),
  // NOT their UTC counterparts. `published_at` is a timestamptz from Postgres
  // (e.g. 2026-04-06T01:00:00Z). A UTC-3 user posted it at 22:00 on Apr 5 local
  // time and expects to see it on the Apr 5 cell — which is exactly what the
  // local getters return.
  const dayMap = new Map<number, CalendarItem[]>();
  filteredItems.forEach((it) => {
    const d = new Date(it.published_at);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      const day = d.getDate();
      const existing = dayMap.get(day) ?? [];
      dayMap.set(day, [...existing, it]);
    }
  });

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const totalThisMonth = filteredItems.filter((it) => {
    const d = new Date(it.published_at);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  }).length;

  const selectedItems = selectedDay ? (dayMap.get(selectedDay) ?? []) : [];

  // Count by type for filter badges
  const typeCounts = {
    reels: items.filter((i) => i.type === "reel").length,
    posts: items.filter((i) => i.type === "post").length,
    historias: items.filter((i) => i.type === "historia").length,
  };

  const FILTERS: { key: ContentFilter; label: string; dot?: string; count?: number }[] = [
    { key: "all", label: "Todo" },
    { key: "reels", label: "Reels", dot: "bg-emerald-400", count: typeCounts.reels },
    { key: "posts", label: "Posts", dot: "bg-violet-400", count: typeCounts.posts },
    { key: "historias", label: "Historias", dot: "bg-cyan-400", count: typeCounts.historias },
  ];

  function handleCellClick(day: number, items: CalendarItem[]) {
    if (items.length === 0) return;
    // Single item → navigate directly to its detail page
    if (items.length === 1) {
      router.push(itemHref(items[0]));
      return;
    }
    // Multiple items → toggle the panel to let the user pick
    setSelectedDay(selectedDay === day ? null : day);
  }

  return (
    <div className="glass-panel rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-light text-white tracking-wide">Calendario de Contenido</h3>
          <p className="text-[11px] text-white/25 mt-0.5 font-light">
            {totalThisMonth} publicación{totalThisMonth !== 1 ? "es" : ""} en {MONTHS[viewMonth]}
          </p>
        </div>

        {/* Content type filter */}
        <div className="flex items-center gap-1 rounded-lg p-1 bg-white/[0.04] border border-white/[0.06]">
          {FILTERS.map(({ key, label, dot, count }) => {
            const disabled = key !== "all" && (count ?? 0) === 0;
            return (
              <button
                key={key}
                onClick={() => {
                  if (disabled) return;
                  setFilter(key);
                  setSelectedDay(null);
                }}
                disabled={disabled}
                title={disabled ? "No hay contenido de este tipo en los últimos 90 días" : undefined}
                aria-disabled={disabled}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  disabled
                    ? "text-white/15 cursor-not-allowed opacity-50"
                    : filter === key
                    ? "bg-white/[0.08] text-white cursor-pointer"
                    : "text-white/30 hover:text-white/55 cursor-pointer"
                }`}
              >
                {dot && filter === key && !disabled && <div className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
                {label}
                {count != null && !disabled && (
                  <span className="text-white/30 text-[10px]">·{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-white/[0.06]"
          style={{ border: "1px solid var(--border)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5 text-white/50" />
        </button>
        <span className="text-[12px] text-white/50 uppercase tracking-[0.12em] font-medium">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:bg-white/[0.06]"
          style={{ border: "1px solid var(--border)" }}
        >
          <ChevronRight className="h-3.5 w-3.5 text-white/50" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-white/20 font-medium uppercase tracking-wider py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — tall cells */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="min-h-[100px]" />;
          const dayItems = dayMap.get(day) ?? [];
          const hasContent = dayItems.length > 0;
          const isToday = isCurrentMonth && day === today;
          const isPast = isCurrentMonth ? day < today : viewYear < currentYear || (viewYear === currentYear && viewMonth < currentMonth);
          const isSelected = selectedDay === day;

          // Best item by views (for preview dot + caption)
          const best = hasContent ? [...dayItems].sort((a, b) => b.views_total - a.views_total)[0] : null;
          const hasAds = best?.has_ads ?? false;
          const bestDotColor =
            best?.type === "post" ? "bg-violet-400"
            : best?.type === "historia" ? "bg-cyan-400"
            : hasAds ? "bg-blue-400" : "bg-emerald-400";

          return (
            <div
              key={day}
              onClick={() => handleCellClick(day, dayItems)}
              className={`relative flex flex-col rounded-xl min-h-[100px] p-2.5 transition-all ${
                isToday ? "ring-1 ring-white/30" : ""
              } ${
                hasContent ? "hover:bg-white/[0.06] cursor-pointer" : isPast ? "opacity-35" : ""
              } ${
                isSelected ? "bg-white/[0.08] ring-1 ring-white/20" : hasContent ? "bg-white/[0.03]" : ""
              }`}
              style={isToday && !hasContent ? { background: "var(--muted)" } : undefined}
            >
              {/* Day number */}
              <span className={`text-[13px] leading-none mb-2 ${
                isToday ? "text-white font-semibold" : hasContent ? "text-white/70 font-medium" : "text-white/20 font-light"
              }`}>
                {day}
              </span>

              {/* Content preview */}
              {best && (
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${bestDotColor} opacity-85`} />
                    {dayItems.length > 1 && (
                      <span className="text-[9px] text-white/30">+{dayItems.length - 1}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/55 font-light leading-snug line-clamp-3 break-words flex-1">
                    {best.caption?.slice(0, 55) || (best.type === "historia" ? "Historia" : "Sin título")}
                  </p>
                  <div className="flex items-center gap-2 mt-auto pt-1.5 border-t border-white/[0.06]">
                    <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                      <Eye className="h-2.5 w-2.5" />
                      {fmt(best.views_total)}
                    </span>
                    {best.likes > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                        <Heart className="h-2.5 w-2.5" />
                        {fmt(best.likes)}
                      </span>
                    )}
                    {best.saves > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/40">
                        <Bookmark className="h-2.5 w-2.5" />
                        {fmt(best.saves)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail panel — only when multiple items on the selected day */}
      {selectedDay && selectedItems.length > 1 && (
        <div className="mt-4 rounded-xl p-4 space-y-3 bg-white/[0.03] border border-white/[0.07]">
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-[0.1em]">
            {selectedDay} de {MONTHS[viewMonth]} {viewYear} — {selectedItems.length} publicaciones
          </p>
          <div className="space-y-2">
            {selectedItems.map((item) => (
              <Link
                key={item.id}
                href={itemHref(item)}
                className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.04] transition-all group bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.05]">
                  <Play className="h-3.5 w-3.5 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-light text-white/70 group-hover:text-white transition-colors truncate">
                    {item.caption?.slice(0, 80) || (item.type === "historia" ? "Historia" : "Sin título")}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Eye className="h-3 w-3" /> {fmt(item.views_total)} vistas
                    </span>
                    {item.likes > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Heart className="h-3 w-3" /> {fmt(item.likes)}
                      </span>
                    )}
                    {item.saves > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Bookmark className="h-3 w-3" /> {fmt(item.saves)}
                      </span>
                    )}
                    {item.comments > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <MessageCircle className="h-3 w-3" /> {fmt(item.comments)}
                      </span>
                    )}
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ml-auto ${
                      item.type === "historia"
                        ? "text-cyan-400/70 bg-cyan-400/10"
                        : item.type === "post"
                        ? "text-violet-400/70 bg-violet-400/10"
                        : item.has_ads
                        ? "text-blue-400/70 bg-blue-400/10"
                        : "text-emerald-400/70 bg-emerald-400/10"
                    }`}>
                      {item.type === "historia" ? "Historia" : item.type === "post" ? "Post" : item.has_ads ? "Reel con ads" : "Reel orgánico"}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-white/20 group-hover:text-white/50 transition-colors text-[10px] self-center">→</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-5 pt-4 border-t border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Reel orgánico</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Reel con ads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-violet-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Post/Carrusel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-cyan-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Historia</span>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] text-white/15 font-light">{totalThisMonth} publicaciones en {MONTHS[viewMonth]}</span>
        </div>
      </div>
    </div>
  );
}
