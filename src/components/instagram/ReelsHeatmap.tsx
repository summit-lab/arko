"use client";

import { useState } from "react";
import Link from "next/link";

interface ReelPoint {
  id: string;
  published_at: string;
  views_total: number;
  caption: string | null;
}

interface Props {
  reels: ReelPoint[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ReelsHeatmap({ reels }: Props) {
  const [hovered, setHovered] = useState<{ reel: ReelPoint; x: number; y: number } | null>(null);

  if (reels.length === 0) return null;

  // Build a map: ISO date → reels published that day
  const byDate = new Map<string, ReelPoint[]>();
  reels.forEach((r) => {
    if (!r.published_at) return;
    const dateKey = r.published_at.split("T")[0];
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(r);
  });

  // Determine date range: oldest to today
  const allDates = [...byDate.keys()].sort();
  if (allDates.length === 0) return null;
  const earliest = new Date(allDates[0]);
  const today = new Date();

  // Align to Sunday of the earliest week
  const startDate = new Date(earliest);
  startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());

  // Build weeks array
  const weeks: (string | null)[][] = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        week.push(null);
      } else {
        week.push(cursor.toISOString().split("T")[0]);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  // Max views in any single day (for color scale)
  const maxViews = Math.max(
    ...([...byDate.values()].map((rs) => rs.reduce((s, r) => s + r.views_total, 0))),
    1
  );

  function cellColor(dateKey: string | null): string {
    if (!dateKey) return "transparent";
    const rs = byDate.get(dateKey);
    if (!rs || rs.length === 0) return "rgba(255,255,255,0.04)";
    const totalViews = rs.reduce((s, r) => s + r.views_total, 0);
    const ratio = totalViews / maxViews;
    // Scale from dim violet to bright emerald
    if (ratio > 0.75) return "rgba(52,211,153,0.90)";
    if (ratio > 0.5)  return "rgba(52,211,153,0.65)";
    if (ratio > 0.25) return "rgba(52,211,153,0.40)";
    if (ratio > 0)    return "rgba(52,211,153,0.20)";
    return "rgba(255,255,255,0.04)";
  }

  const GAP = 3;
  const CELL_H = 14;

  return (
    <div className="glass-panel rounded-xl px-5 py-4 relative">
      <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em] mb-1">Heatmap de Publicación</p>
      <p className="text-[9px] text-white/20 mb-4">Intensidad de views por día · click para ver el reel</p>

      <div className="flex gap-2">
        {/* Y-axis day labels */}
        <div className="flex flex-col shrink-0" style={{ gap: GAP }}>
          {DAYS_ES.map((day, i) => (
            <div key={day} className="flex items-center justify-end"
              style={{ height: CELL_H, fontSize: 9, color: "rgba(255,255,255,0.25)", width: 22, lineHeight: 1 }}>
              {i % 2 === 1 ? day : ""}
            </div>
          ))}
        </div>

        {/* Week columns — stretch to fill full panel width */}
        <div className="flex-1 min-w-0 flex" style={{ gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex-1 flex flex-col" style={{ gap: GAP }}>
              {week.map((dateKey, di) => {
                const rs = dateKey ? (byDate.get(dateKey) ?? []) : [];
                const hasReels = rs.length > 0;
                return (
                  <div
                    key={di}
                    className="w-full rounded-[3px] transition-all duration-150"
                    style={{
                      height: CELL_H,
                      background: cellColor(dateKey),
                      cursor: hasReels ? "pointer" : "default",
                      outline: hasReels && hovered?.reel && rs.includes(hovered.reel) ? "2px solid rgba(52,211,153,0.8)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (hasReels) {
                        setHovered({ reel: rs[0], x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {hasReels && (
                      <Link href={`/instagram/${rs[0].id}`} className="block w-full h-full" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] text-white/20">Menos</span>
        {["rgba(255,255,255,0.04)", "rgba(52,211,153,0.20)", "rgba(52,211,153,0.40)", "rgba(52,211,153,0.65)", "rgba(52,211,153,0.90)"].map((c, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 12, height: 12, background: c }} />
        ))}
        <span className="text-[9px] text-white/20">Más</span>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-white/10 px-3 py-2 text-[11px]"
          style={{
            background: "rgba(10,10,20,0.95)",
            backdropFilter: "blur(20px)",
            left: hovered.x + 12,
            top: hovered.y - 40,
            maxWidth: 200,
          }}
        >
          <p className="text-white/40 text-[10px] mb-0.5">{hovered.reel.published_at?.split("T")[0]}</p>
          <p className="text-white leading-snug">{fmt(hovered.reel.views_total)} views</p>
          <p className="text-white/50 mt-0.5 leading-snug truncate">
            {hovered.reel.caption?.slice(0, 40) ?? "Sin caption"}
          </p>
        </div>
      )}
    </div>
  );
}
