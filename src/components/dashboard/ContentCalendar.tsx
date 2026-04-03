"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Heart, Bookmark, MessageCircle, Play, Megaphone, BookImage } from "lucide-react";

interface CalendarReel {
  id: string;
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
  reels: CalendarReel[];
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

export function ContentCalendar({ reels }: ContentCalendarProps) {
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // For now, all items are reels — filter logic ready for when posts/historias come
  const filteredReels = reels.filter((r) => {
    if (filter === "historias") return false; // no stories data in this feed yet
    if (filter === "posts") return false; // no posts data in this feed yet
    if (filter === "reels") return true;
    return true; // "all"
  });

  // Map days that have content — include full reel data
  const dayMap = new Map<number, CalendarReel[]>();
  filteredReels.forEach((r) => {
    const d = new Date(r.published_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const existing = dayMap.get(day) ?? [];
      dayMap.set(day, [...existing, r]);
    }
  });

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const totalThisMonth = reels.filter((r) => {
    const d = new Date(r.published_at);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  const selectedItems = selectedDay ? (dayMap.get(selectedDay) ?? []) : [];

  const FILTERS: { key: ContentFilter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "Todo", icon: Eye },
    { key: "reels", label: "Reels", icon: Play },
    { key: "posts", label: "Posts", icon: BookImage },
    { key: "historias", label: "Historias", icon: Megaphone },
  ];

  return (
    <div className="glass-panel rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-light text-white tracking-wide">Calendario de Contenido</h3>
          <p className="text-[11px] text-white/25 mt-0.5 font-light">
            {totalThisMonth} publicación{totalThisMonth !== 1 ? "es" : ""} en {MONTHS[month]}
          </p>
        </div>

        {/* Content type filter */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setSelectedDay(null); }}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                filter === key
                  ? "bg-white/[0.08] text-white"
                  : "text-white/30 hover:text-white/55"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Month label */}
      <div className="flex items-center justify-end mb-3">
        <span className="text-[10px] text-white/20 uppercase tracking-[0.15em] font-medium">
          {MONTHS[month]} {year}
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-white/20 font-medium uppercase tracking-wider py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — taller cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="min-h-[80px]" />;
          const items = dayMap.get(day) ?? [];
          const hasContent = items.length > 0;
          const isToday = day === today;
          const isPast = day < today;
          const isSelected = selectedDay === day;

          // Best item by views for preview
          const best = hasContent ? [...items].sort((a, b) => b.views_total - a.views_total)[0] : null;

          return (
            <div
              key={day}
              onClick={() => hasContent ? setSelectedDay(isSelected ? null : day) : undefined}
              className={`relative flex flex-col rounded-lg min-h-[80px] p-2 transition-all ${
                isToday ? "ring-1 ring-white/25" : ""
              } ${
                hasContent
                  ? "hover:bg-white/[0.06] cursor-pointer"
                  : isPast
                  ? "opacity-35"
                  : ""
              } ${
                isSelected ? "bg-white/[0.08] ring-1 ring-white/20" : hasContent ? "bg-white/[0.03]" : ""
              }`}
              style={isToday && !hasContent ? { background: "rgba(255,255,255,0.05)" } : undefined}
            >
              {/* Day number */}
              <span className={`text-[12px] leading-none mb-1.5 ${
                isToday ? "text-white font-medium" : hasContent ? "text-white/70 font-light" : "text-white/20 font-light"
              }`}>
                {day}
              </span>

              {/* Content preview — show first item */}
              {best && (
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  {/* Content type dot */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${best.has_ads ? "bg-blue-400" : "bg-emerald-400"} opacity-80`} />
                    {items.length > 1 && (
                      <span className="text-[8px] text-white/25">+{items.length - 1}</span>
                    )}
                  </div>
                  {/* Caption truncated */}
                  <p className="text-[9px] text-white/50 font-light leading-tight line-clamp-2 break-words">
                    {best.caption?.slice(0, 40) || "Sin título"}
                  </p>
                  {/* Quick KPIs */}
                  <div className="flex items-center gap-1.5 mt-auto pt-1">
                    <span className="flex items-center gap-0.5 text-[8px] text-white/40">
                      <Eye className="h-2 w-2" />
                      {fmt(best.views_total)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[8px] text-white/40">
                      <Heart className="h-2 w-2" />
                      {fmt(best.likes)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDay && selectedItems.length > 0 && (
        <div
          className="mt-4 rounded-xl p-4 space-y-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-[11px] text-white/40 font-medium uppercase tracking-[0.1em]">
            {selectedDay} de {MONTHS[month]} — {selectedItems.length} publicación{selectedItems.length !== 1 ? "es" : ""}
          </p>
          <div className="space-y-2">
            {selectedItems.map((item) => (
              <Link
                key={item.id}
                href={`/instagram/${item.id}`}
                className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.04] transition-all group"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {/* Type icon */}
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  <Play className="h-3.5 w-3.5 text-white/40" />
                </div>
                {/* Caption */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-light text-white/70 group-hover:text-white transition-colors truncate">
                    {item.caption?.slice(0, 80) || "Sin título"}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Eye className="h-3 w-3" /> {fmt(item.views_total)} vistas
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Heart className="h-3 w-3" /> {fmt(item.likes)} me gusta
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <Bookmark className="h-3 w-3" /> {fmt(item.saves)} guardados
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                      <MessageCircle className="h-3 w-3" /> {fmt(item.comments)}
                    </span>
                    {item.has_ads && (
                      <span className="text-[9px] font-medium text-blue-400/70 bg-blue-400/10 px-1.5 py-0.5 rounded-full">Ads</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-white/20 group-hover:text-white/50 transition-colors text-[10px] self-center">→</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Orgánico</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-400 opacity-80" />
          <span className="text-[10px] text-white/25 font-light">Con anuncios</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-white/30" />
          <span className="text-[10px] text-white/25 font-light">Hoy</span>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] text-white/15 font-light">{totalThisMonth} publicaciones totales</span>
        </div>
      </div>
    </div>
  );
}
