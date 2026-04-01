"use client";

import { useState } from "react";

interface CalendarReel {
  published_at: string;
  caption: string | null;
  has_ads: boolean;
  reel_type?: string;
}

interface ContentCalendarProps {
  reels: CalendarReel[];
}

const DAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Filter = "all" | "organic" | "ads";

export function ContentCalendar({ reels }: ContentCalendarProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Filter reels by platform toggle
  const filteredReels = reels.filter((r) => {
    if (filter === "organic") return !r.has_ads;
    if (filter === "ads") return r.has_ads;
    return true;
  });

  // Map days that have content
  const dayMap = new Map<number, { organic: boolean; ads: boolean; count: number }>();
  filteredReels.forEach((r) => {
    const d = new Date(r.published_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const existing = dayMap.get(day) ?? { organic: false, ads: false, count: 0 };
      dayMap.set(day, {
        organic: existing.organic || !r.has_ads,
        ads: existing.ads || r.has_ads,
        count: existing.count + 1,
      });
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

  const totalFiltered = filteredReels.filter((r) => {
    const d = new Date(r.published_at);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  return (
    <div className="glass-panel rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[15px] font-light text-white tracking-wide">Calendario de Contenido</h3>
          <p className="text-[11px] text-white/25 mt-0.5 font-light">
            {totalFiltered} publicacion{totalFiltered !== 1 ? "es" : ""} en {MONTHS[month]}
            {filter !== "all" && ` · ${filter === "ads" ? "con anuncios" : "orgánico"}`}
          </p>
        </div>

        {/* Platform filter toggle */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { key: "all", label: "Todo" },
            { key: "organic", label: "Orgánico" },
            { key: "ads", label: "Ads" },
          ] as { key: Filter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
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
      <div className="flex items-center justify-between mb-3">
        <div /> {/* spacer */}
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const info = dayMap.get(day);
          const hasContent = !!info;
          const isToday = day === today;
          const isPast = day < today;

          return (
            <div
              key={day}
              title={hasContent ? `${info!.count} publicación${info!.count > 1 ? "es" : ""}` : undefined}
              className={`relative flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
                isToday
                  ? "ring-1 ring-white/25"
                  : ""
              } ${
                hasContent
                  ? "hover:bg-white/[0.05] cursor-pointer"
                  : isPast
                  ? "opacity-40"
                  : ""
              }`}
              style={isToday ? { background: "rgba(255,255,255,0.06)" } : hasContent ? { background: "rgba(255,255,255,0.03)" } : {}}
            >
              <span
                className={`text-[12px] leading-none ${
                  isToday
                    ? "text-white font-medium"
                    : hasContent
                    ? "text-white/80 font-light"
                    : "text-white/20 font-light"
                }`}
              >
                {day}
              </span>
              {hasContent && (
                <div className="flex gap-0.5 mt-1.5">
                  {info!.organic && (
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-80" />
                  )}
                  {info!.ads && (
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 opacity-80" />
                  )}
                  {info!.count > 1 && (
                    <span className="text-[8px] text-white/30 leading-none ml-0.5 mt-0.5">+{info!.count - 1}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-5 pt-4 border-t border-white/[0.05]">
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
