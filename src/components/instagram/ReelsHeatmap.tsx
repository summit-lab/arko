"use client";

import { useState } from "react";
import Link from "next/link";
import { useChartTheme } from "@/hooks/useChartTheme";

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

// Convert a timestamptz string to a YYYY-MM-DD key in the viewer's LOCAL timezone.
// A reel published at 2026-04-06T01:00:00Z should bucket as 2026-04-05 for a
// UTC-3 user (22:00 local on Apr 5), matching the day they actually posted it.
function localDateKey(ts: string): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Build a YYYY-MM-DD key from an already-local Date (no timezone shift).
function dateToLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReelsHeatmap({ reels }: Props) {
  const [hovered, setHovered] = useState<{ reel: ReelPoint; x: number; y: number } | null>(null);
  const chart = useChartTheme();
  const emptyCell = chart.trackFill;

  if (reels.length === 0) return null;

  // Build a map: local-date key (YYYY-MM-DD in viewer TZ) → reels published that day
  const byDate = new Map<string, ReelPoint[]>();
  reels.forEach((r) => {
    if (!r.published_at) return;
    const dateKey = localDateKey(r.published_at);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(r);
  });

  // Determine date range: oldest to today
  const allDates = [...byDate.keys()].sort();
  if (allDates.length === 0) return null;
  // Parse the YYYY-MM-DD key as a LOCAL date (not UTC) so the week alignment
  // below reflects the viewer's calendar, not UTC's.
  const [ey, em, ed] = allDates[0].split("-").map(Number);
  const earliest = new Date(ey, em - 1, ed);
  const today = new Date();

  // Align to Sunday of the earliest week (local time)
  const startDate = new Date(earliest);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Build weeks array (all operations in local time)
  const weeks: (string | null)[][] = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor > today) {
        week.push(null);
      } else {
        week.push(dateToLocalKey(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  // Max views in any single day (for color scale)
  const maxViews = Math.max(
    ...([...byDate.values()].map((rs) => rs.reduce((s, r) => s + r.views_total, 0))),
    1
  );

  // In light mode, bump the minimum alpha so the lightest shade is still visible on white.
  const heatScale = chart.isDark
    ? ["rgba(52,211,153,0.20)", "rgba(52,211,153,0.40)", "rgba(52,211,153,0.65)", "rgba(52,211,153,0.90)"]
    : ["rgba(52,211,153,0.45)", "rgba(52,211,153,0.65)", "rgba(52,211,153,0.82)", "rgba(16,150,105,0.95)"];

  function cellColor(dateKey: string | null): string {
    if (!dateKey) return "transparent";
    const rs = byDate.get(dateKey);
    if (!rs || rs.length === 0) return emptyCell;
    const totalViews = rs.reduce((s, r) => s + r.views_total, 0);
    const ratio = totalViews / maxViews;
    // Scale from dim to bright emerald
    if (ratio > 0.75) return heatScale[3];
    if (ratio > 0.5)  return heatScale[2];
    if (ratio > 0.25) return heatScale[1];
    if (ratio > 0)    return heatScale[0];
    return emptyCell;
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
            <div key={day} className="flex items-center justify-end text-muted-foreground"
              style={{ height: CELL_H, fontSize: 9, width: 22, lineHeight: 1 }}>
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
        {[emptyCell, ...heatScale].map((c, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 12, height: 12, background: c }} />
        ))}
        <span className="text-[9px] text-white/20">Más</span>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2 text-[11px] backdrop-blur-xl shadow-xl"
          style={{
            left: hovered.x + 12,
            top: hovered.y - 40,
            maxWidth: 200,
          }}
        >
          <p className="text-muted-foreground text-[10px] mb-0.5">{hovered.reel.published_at ? localDateKey(hovered.reel.published_at) : ""}</p>
          <p className="text-popover-foreground leading-snug">{fmt(hovered.reel.views_total)} views</p>
          <p className="text-muted-foreground mt-0.5 leading-snug truncate">
            {hovered.reel.caption?.slice(0, 40) ?? "Sin caption"}
          </p>
        </div>
      )}
    </div>
  );
}
