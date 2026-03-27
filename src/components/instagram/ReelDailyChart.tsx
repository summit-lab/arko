"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyDataPoint {
  date: string;
  views: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
}

interface ReelDailyChartProps {
  data: DailyDataPoint[];
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 backdrop-blur-xl"
      style={{
        background: "rgba(10,10,20,0.55)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-[11px] text-white/40 font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-[11px] text-white/60 font-light">{entry.name}</span>
          <span className="text-[12px] text-white font-light ml-auto">{formatCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ReelDailyChart({ data }: ReelDailyChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-xs text-zinc-300">
        Sin datos diarios para este reel todavía.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Views over time */}
      <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        <h4 className="text-sm font-semibold text-zinc-100 mb-4">Views por día</h4>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Area type="monotone" dataKey="views" name="Views" stroke="#818cf8" strokeWidth={2} fill="url(#gradViews)" isAnimationActive animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engagement breakdown */}
      <div className="glass-panel rounded-xl border border-white/10 bg-black/35 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-zinc-100">Engagement por día</h4>
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#f472b6]" />
              <span>Likes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
              <span>Saves</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
              <span>Comments</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
              <span>Shares</span>
            </div>
          </div>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickFormatter={(v: number) => formatCompact(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="likes" name="Likes" fill="#f472b6" radius={[3, 3, 0, 0]} barSize={6} fillOpacity={0.8} />
              <Bar dataKey="saves" name="Saves" fill="#22d3ee" radius={[3, 3, 0, 0]} barSize={6} fillOpacity={0.8} />
              <Bar dataKey="comments" name="Comments" fill="#34d399" radius={[3, 3, 0, 0]} barSize={6} fillOpacity={0.8} />
              <Bar dataKey="shares" name="Shares" fill="#60a5fa" radius={[3, 3, 0, 0]} barSize={6} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
