"use client";

import { useRouter } from "next/navigation";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useChartTheme } from "@/hooks/useChartTheme";

interface ReelPoint {
  id: string;
  caption: string | null;
  published_at: string;
  views_total: number;
  performer_multiple: number | null;
}

interface Props {
  reels: ReelPoint[];
  avgViews: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function ScatterTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { id: string; caption: string | null; views: number; date: number; multiple: number | null } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2 text-[11px] pointer-events-none backdrop-blur-xl shadow-xl" style={{ maxWidth: 220 }}>
      <p className="text-muted-foreground text-[10px] mb-1">{fmtDate(d.date)}</p>
      <p className="text-popover-foreground font-medium">{fmt(d.views)} views</p>
      {d.multiple != null && (
        <p className="text-amber-400 text-[10px]">×{d.multiple.toFixed(1)} vs promedio</p>
      )}
      <p className="text-muted-foreground mt-1 leading-snug">
        {d.caption ? (d.caption.length > 50 ? d.caption.slice(0, 50) + "…" : d.caption) : "Sin caption"}
      </p>
      <p className="text-indigo-400 text-[10px] mt-1">Click para ver el reel →</p>
    </div>
  );
}

export function ReelsScatterPlot({ reels, avgViews }: Props) {
  const router = useRouter();
  const chart = useChartTheme();

  if (reels.length < 3) return null;

  const data = reels
    .filter((r) => r.published_at)
    .map((r) => ({
      id: r.id,
      caption: r.caption,
      date: new Date(r.published_at).getTime(),
      views: r.views_total,
      multiple: r.performer_multiple,
    }))
    .sort((a, b) => a.date - b.date);

  const minDate = data[0].date;
  const maxDate = data[data.length - 1].date;
  const dateRange = maxDate - minDate || 1;

  // X-axis ticks: up to 6 evenly spaced dates
  const tickCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    Math.round(minDate + (dateRange / (tickCount - 1)) * i)
  );

  return (
    <div className="glass-panel rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">Views por Reel</p>
        <span className="text-[9px] text-white/20">promedio: {fmt(avgViews)} views</span>
      </div>
      <p className="text-[9px] text-white/20 mb-4">Cada punto es un reel · click para verlo · línea = promedio</p>

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
            <XAxis
              dataKey="date"
              type="number"
              domain={[minDate, maxDate]}
              ticks={xTicks}
              tickFormatter={(v: number) => fmtDate(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: chart.axisTick, fontSize: 10 }}
              scale="time"
            />
            <YAxis
              dataKey="views"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: chart.axisTick, fontSize: 10 }}
              tickFormatter={(v: number) => fmt(v)}
              width={42}
            />
            <ReferenceLine
              y={avgViews}
              stroke="rgba(129,140,248,0.5)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3", stroke: chart.grid }} />
            <Scatter
              data={data}
              onClick={(d) => router.push(`/instagram/${(d as unknown as { id: string }).id}`)}
              shape={(props: {
                cx?: number; cy?: number;
                payload?: { views: number; multiple: number | null };
              }) => {
                const { cx = 0, cy = 0, payload } = props;
                const views = payload?.views ?? 0;
                const multiple = payload?.multiple ?? 0;
                const isOutlier = multiple >= 3;
                const color = isOutlier
                  ? (multiple >= 8 ? "#fbbf24" : multiple >= 5 ? "#34d399" : "#60a5fa")
                  : "rgba(129,140,248,0.7)";
                const r = isOutlier ? 7 : 5;
                return (
                  <g style={{ cursor: "pointer" }}>
                    {isOutlier && (
                      <circle cx={cx} cy={cy} r={r + 4} fill={color} fillOpacity={0.15} />
                    )}
                    <circle
                      cx={cx} cy={cy} r={r}
                      fill={color}
                      fillOpacity={0.85}
                      stroke={isOutlier ? color : chart.benchmarkDotStroke}
                      strokeWidth={isOutlier ? 1.5 : 0.5}
                    />
                    {views > 0 && false && <title>{fmt(views)}</title>}
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[9px] text-white/25">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#818cf8]/70" />
          <span>Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#60a5fa]" />
          <span>×3+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#34d399]" />
          <span>×5+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#fbbf24]" />
          <span>×8+ outlier</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <div className="h-[1px] w-6 border-t border-dashed border-[#818cf8]/50" />
          <span>promedio</span>
        </div>
      </div>
    </div>
  );
}
